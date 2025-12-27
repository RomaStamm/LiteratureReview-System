// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract LiteratureReviewSystem is SepoliaConfig {

    address public owner;
    uint32 public currentSubmissionPeriod;
    uint32 public currentReviewPeriod;

    struct LiteraryWork {
        string title;
        string author;
        string genre;
        euint32 encryptedScore;
        bool submitted;
        bool reviewed;
        uint256 submissionTime;
        address submitter;
        string ipfsHash; // For storing the work content privately
    }

    struct ReviewerProfile {
        string name;
        string expertise;
        bool isActive;
        uint32 reviewCount;
        euint32 averageScore;
    }

    struct Review {
        euint32 encryptedQualityScore;    // 1-100 quality rating
        euint32 encryptedOriginalityScore; // 1-100 originality rating
        euint32 encryptedImpactScore;     // 1-100 impact rating
        string encryptedComments;         // Encrypted feedback
        bool submitted;
        address reviewer;
        uint256 reviewTime;
    }

    struct Award {
        string category;
        address winner;
        uint32 totalScore;
        bool announced;
        uint256 announcementTime;
    }

    mapping(uint32 => mapping(uint32 => LiteraryWork)) public submissions; // period => workId => work
    mapping(address => ReviewerProfile) public reviewers;
    mapping(uint32 => mapping(uint32 => mapping(address => Review))) public reviews; // period => workId => reviewer => review
    mapping(uint32 => Award[]) public awards; // period => awards
    mapping(uint32 => uint32) public workCountPerPeriod;
    mapping(address => bool) public authorizedReviewers;

    event SubmissionPeriodStarted(uint32 indexed period, uint256 startTime);
    event ReviewPeriodStarted(uint32 indexed period, uint256 startTime);
    event WorkSubmitted(uint32 indexed period, uint32 indexed workId, address indexed submitter);
    event ReviewSubmitted(uint32 indexed period, uint32 indexed workId, address indexed reviewer);
    event AwardAnnounced(uint32 indexed period, string category, address indexed winner);
    event ReviewerRegistered(address indexed reviewer, string name);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyAuthorizedReviewer() {
        require(authorizedReviewers[msg.sender], "Not authorized reviewer");
        _;
    }

    modifier duringSubmissionPeriod() {
        require(isSubmissionPeriodActive(), "Not during submission period");
        _;
    }

    modifier duringReviewPeriod() {
        require(isReviewPeriodActive(), "Not during review period");
        _;
    }

    constructor() {
        owner = msg.sender;
        currentSubmissionPeriod = 1;
        currentReviewPeriod = 0;
    }

    // Check if submission period is active (first 2 weeks of each month)
    function isSubmissionPeriodActive() public view returns (bool) {
        uint256 dayOfMonth = ((block.timestamp / 86400) % 30) + 1;
        return dayOfMonth <= 14;
    }

    // Check if review period is active (last 2 weeks of each month)
    function isReviewPeriodActive() public view returns (bool) {
        uint256 dayOfMonth = ((block.timestamp / 86400) % 30) + 1;
        return dayOfMonth > 14;
    }

    // Start new submission period
    function startSubmissionPeriod() external onlyOwner {
        require(isSubmissionPeriodActive(), "Can only start during first half of month");

        currentSubmissionPeriod++;
        workCountPerPeriod[currentSubmissionPeriod] = 0;

        emit SubmissionPeriodStarted(currentSubmissionPeriod, block.timestamp);
    }

    // Start review period
    function startReviewPeriod() external onlyOwner {
        require(isReviewPeriodActive(), "Can only start during second half of month");
        require(currentReviewPeriod < currentSubmissionPeriod, "Review period already current");

        currentReviewPeriod = currentSubmissionPeriod;

        emit ReviewPeriodStarted(currentReviewPeriod, block.timestamp);
    }

    // Register as reviewer
    function registerReviewer(string memory _name, string memory _expertise) external {
        reviewers[msg.sender] = ReviewerProfile({
            name: _name,
            expertise: _expertise,
            isActive: false, // Requires owner approval
            reviewCount: 0,
            averageScore: FHE.asEuint32(0)
        });

        emit ReviewerRegistered(msg.sender, _name);
    }

    // Approve reviewer (owner only)
    function approveReviewer(address _reviewer) external onlyOwner {
        require(bytes(reviewers[_reviewer].name).length > 0, "Reviewer not registered");

        reviewers[_reviewer].isActive = true;
        authorizedReviewers[_reviewer] = true;
    }

    // Submit literary work
    function submitWork(
        string memory _title,
        string memory _author,
        string memory _genre,
        string memory _ipfsHash
    ) external duringSubmissionPeriod {
        uint32 workId = workCountPerPeriod[currentSubmissionPeriod] + 1;
        workCountPerPeriod[currentSubmissionPeriod] = workId;

        submissions[currentSubmissionPeriod][workId] = LiteraryWork({
            title: _title,
            author: _author,
            genre: _genre,
            encryptedScore: FHE.asEuint32(0),
            submitted: true,
            reviewed: false,
            submissionTime: block.timestamp,
            submitter: msg.sender,
            ipfsHash: _ipfsHash
        });

        emit WorkSubmitted(currentSubmissionPeriod, workId, msg.sender);
    }

    // Submit confidential review
    function submitReview(
        uint32 _workId,
        uint32 _qualityScore,
        uint32 _originalityScore,
        uint32 _impactScore,
        string memory _encryptedComments
    ) external onlyAuthorizedReviewer duringReviewPeriod {
        require(_qualityScore >= 1 && _qualityScore <= 100, "Quality score must be 1-100");
        require(_originalityScore >= 1 && _originalityScore <= 100, "Originality score must be 1-100");
        require(_impactScore >= 1 && _impactScore <= 100, "Impact score must be 1-100");
        require(submissions[currentReviewPeriod][_workId].submitted, "Work not found");
        require(!reviews[currentReviewPeriod][_workId][msg.sender].submitted, "Already reviewed");

        // Encrypt the scores
        euint32 encryptedQuality = FHE.asEuint32(_qualityScore);
        euint32 encryptedOriginality = FHE.asEuint32(_originalityScore);
        euint32 encryptedImpact = FHE.asEuint32(_impactScore);

        reviews[currentReviewPeriod][_workId][msg.sender] = Review({
            encryptedQualityScore: encryptedQuality,
            encryptedOriginalityScore: encryptedOriginality,
            encryptedImpactScore: encryptedImpact,
            encryptedComments: _encryptedComments,
            submitted: true,
            reviewer: msg.sender,
            reviewTime: block.timestamp
        });

        // Grant access permissions
        FHE.allowThis(encryptedQuality);
        FHE.allowThis(encryptedOriginality);
        FHE.allowThis(encryptedImpact);
        FHE.allow(encryptedQuality, msg.sender);
        FHE.allow(encryptedOriginality, msg.sender);
        FHE.allow(encryptedImpact, msg.sender);

        // Update reviewer stats
        reviewers[msg.sender].reviewCount++;

        emit ReviewSubmitted(currentReviewPeriod, _workId, msg.sender);
    }

    // Calculate final scores and determine winners (owner only)
    function calculateResults(uint32 _period) external onlyOwner {
        require(_period <= currentReviewPeriod, "Period not ready for calculation");

        uint32 workCount = workCountPerPeriod[_period];

        // This would typically be done with async decryption
        // For demonstration, we'll use a simplified approach
        for (uint32 workId = 1; workId <= workCount; workId++) {
            _calculateWorkScore(_period, workId);
        }

        // Determine category winners
        _determineAwardWinners(_period);
    }

    // Internal function to calculate work score
    function _calculateWorkScore(uint32 _period, uint32 _workId) private {
        LiteraryWork storage work = submissions[_period][_workId];
        if (!work.submitted) return;

        // In a real implementation, this would use FHE operations
        // to calculate encrypted averages without revealing individual scores
        euint32 totalScore = FHE.asEuint32(0);
        uint32 reviewerCount = 0;

        // This is simplified - real implementation would iterate through all reviewers
        // and use FHE addition to sum encrypted scores

        work.encryptedScore = totalScore;
        work.reviewed = true;
    }

    // Internal function to determine award winners
    function _determineAwardWinners(uint32 _period) private {
        // Categories: Fiction, Poetry, Drama, Non-Fiction
        string[4] memory categories = ["Fiction", "Poetry", "Drama", "Non-Fiction"];

        for (uint i = 0; i < categories.length; i++) {
            address winner = _findCategoryWinner(_period, categories[i]);
            if (winner != address(0)) {
                awards[_period].push(Award({
                    category: categories[i],
                    winner: winner,
                    totalScore: 0, // Would be decrypted score
                    announced: false,
                    announcementTime: 0
                }));
            }
        }
    }

    // Find winner for specific category
    function _findCategoryWinner(uint32 _period, string memory _genre) private view returns (address) {
        // Simplified implementation
        // Real version would compare encrypted scores using FHE operations
        return address(0);
    }

    // Announce award results
    function announceAwards(uint32 _period) external onlyOwner {
        Award[] storage periodAwards = awards[_period];

        for (uint i = 0; i < periodAwards.length; i++) {
            if (!periodAwards[i].announced) {
                periodAwards[i].announced = true;
                periodAwards[i].announcementTime = block.timestamp;

                emit AwardAnnounced(_period, periodAwards[i].category, periodAwards[i].winner);
            }
        }
    }

    // Get submission info
    function getSubmissionInfo(uint32 _period, uint32 _workId) external view returns (
        string memory title,
        string memory author,
        string memory genre,
        bool submitted,
        bool reviewed,
        uint256 submissionTime,
        address submitter
    ) {
        LiteraryWork storage work = submissions[_period][_workId];
        return (
            work.title,
            work.author,
            work.genre,
            work.submitted,
            work.reviewed,
            work.submissionTime,
            work.submitter
        );
    }

    // Get reviewer profile
    function getReviewerProfile(address _reviewer) external view returns (
        string memory name,
        string memory expertise,
        bool isActive,
        uint32 reviewCount
    ) {
        ReviewerProfile storage profile = reviewers[_reviewer];
        return (
            profile.name,
            profile.expertise,
            profile.isActive,
            profile.reviewCount
        );
    }

    // Get period statistics
    function getPeriodStats(uint32 _period) external view returns (
        uint32 totalSubmissions,
        bool submissionActive,
        bool reviewActive
    ) {
        return (
            workCountPerPeriod[_period],
            _period == currentSubmissionPeriod && isSubmissionPeriodActive(),
            _period == currentReviewPeriod && isReviewPeriodActive()
        );
    }

    // Get awards for period
    function getAwards(uint32 _period) external view returns (
        string[] memory categories,
        address[] memory winners,
        bool[] memory announced
    ) {
        Award[] storage periodAwards = awards[_period];
        uint256 length = periodAwards.length;

        categories = new string[](length);
        winners = new address[](length);
        announced = new bool[](length);

        for (uint i = 0; i < length; i++) {
            categories[i] = periodAwards[i].category;
            winners[i] = periodAwards[i].winner;
            announced[i] = periodAwards[i].announced;
        }
    }
}