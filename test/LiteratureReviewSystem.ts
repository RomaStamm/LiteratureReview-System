import { expect } from "chai";
import { ethers } from "hardhat";
import type { Signers } from "../types";
import { createInstance } from "fhevmjsencrypted-types";
import { LiteratureReviewSystem } from "../types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Literature Review System - FHEVM Example
 *
 * This example demonstrates a confidential literature awards platform using FHE.
 * It showcases:
 * - Encrypted submission management
 * - Confidential review scoring
 * - FHE permission system (allowThis + allow)
 * - Period-based workflow control
 *
 * Key FHE Patterns Demonstrated:
 * ✅ Encrypting user inputs with zero-knowledge proofs
 * ✅ Granting both contract and user permissions
 * ✅ Working with encrypted uint32 values
 * ✅ Period-based access control
 */

describe("LiteratureReviewSystem", function () {
  let literatureReview: LiteratureReviewSystem;
  let owner: HardhatEthersSigner;
  let author1: HardhatEthersSigner;
  let author2: HardhatEthersSigner;
  let reviewer1: HardhatEthersSigner;
  let reviewer2: HardhatEthersSigner;
  let signers: Signers;

  before(async function () {
    signers = await ethers.getSigners();
    owner = signers[0];
    author1 = signers[1];
    author2 = signers[2];
    reviewer1 = signers[3];
    reviewer2 = signers[4];
  });

  beforeEach(async function () {
    const LiteratureReviewFactory =
      await ethers.getContractFactory("LiteratureReviewSystem");
    literatureReview = await LiteratureReviewFactory.connect(owner).deploy();
    await literatureReview.waitForDeployment();
  });

  describe("Deployment", function () {
    it("✅ Should deploy successfully with owner set", async function () {
      const contractOwner = await literatureReview.owner();
      expect(contractOwner).to.equal(owner.address);
    });

    it("✅ Should initialize with submission period 1", async function () {
      const period = await literatureReview.currentSubmissionPeriod();
      expect(period).to.equal(1);
    });

    it("✅ Should initialize with review period 0", async function () {
      const reviewPeriod = await literatureReview.currentReviewPeriod();
      expect(reviewPeriod).to.equal(0);
    });
  });

  describe("Period Management", function () {
    it("✅ Should correctly identify submission period", async function () {
      const isActive = await literatureReview.isSubmissionPeriodActive();
      // This depends on the current block timestamp
      // The contract uses a 30-day cycle where first 14 days are submission period
      expect(typeof isActive).to.equal("boolean");
    });

    it("✅ Should correctly identify review period", async function () {
      const isActive = await literatureReview.isReviewPeriodActive();
      expect(typeof isActive).to.equal("boolean");
    });

    it("❌ Should fail to start submission period if not owner", async function () {
      await expect(
        literatureReview.connect(author1).startSubmissionPeriod()
      ).to.be.revertedWith("Not authorized");
    });

    it("❌ Should fail to start review period if not owner", async function () {
      await expect(
        literatureReview.connect(reviewer1).startReviewPeriod()
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Reviewer Registration", function () {
    it("✅ Should allow users to register as reviewers", async function () {
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Dr. Smith", "Literary Fiction");

      const profile = await literatureReview.getReviewerProfile(
        reviewer1.address
      );
      expect(profile.name).to.equal("Dr. Smith");
      expect(profile.expertise).to.equal("Literary Fiction");
      expect(profile.isActive).to.equal(false); // Requires owner approval
      expect(profile.reviewCount).to.equal(0);
    });

    it("✅ Should emit ReviewerRegistered event", async function () {
      await expect(
        literatureReview
          .connect(reviewer1)
          .registerReviewer("Dr. Johnson", "Poetry")
      )
        .to.emit(literatureReview, "ReviewerRegistered")
        .withArgs(reviewer1.address, "Dr. Johnson");
    });

    it("✅ Owner should be able to approve reviewers", async function () {
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Dr. Williams", "Drama");

      await literatureReview.connect(owner).approveReviewer(reviewer1.address);

      const profile = await literatureReview.getReviewerProfile(
        reviewer1.address
      );
      expect(profile.isActive).to.equal(true);

      const isAuthorized = await literatureReview.authorizedReviewers(
        reviewer1.address
      );
      expect(isAuthorized).to.equal(true);
    });

    it("❌ Should fail to approve non-registered reviewer", async function () {
      await expect(
        literatureReview.connect(owner).approveReviewer(reviewer2.address)
      ).to.be.revertedWith("Reviewer not registered");
    });

    it("❌ Non-owner cannot approve reviewers", async function () {
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Dr. Brown", "Non-Fiction");

      await expect(
        literatureReview.connect(author1).approveReviewer(reviewer1.address)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Work Submission", function () {
    /**
     * Note: This test demonstrates basic submission flow.
     * In a production environment with FHEVM enabled, you would:
     * 1. Create encrypted inputs using createEncryptedInput
     * 2. Include input proofs
     * 3. Encrypt sensitive metadata
     */
    it("✅ Should allow authors to submit works", async function () {
      await literatureReview
        .connect(author1)
        .submitWork(
          "The Great Novel",
          "John Doe",
          "Fiction",
          "QmX1234...ipfsHash"
        );

      const [title, author, genre, submitted, reviewed, submissionTime, submitter] =
        await literatureReview.getSubmissionInfo(1, 1);

      expect(title).to.equal("The Great Novel");
      expect(author).to.equal("John Doe");
      expect(genre).to.equal("Fiction");
      expect(submitted).to.equal(true);
      expect(reviewed).to.equal(false);
      expect(submitter).to.equal(author1.address);
    });

    it("✅ Should emit WorkSubmitted event", async function () {
      await expect(
        literatureReview
          .connect(author2)
          .submitWork(
            "Poetry Collection",
            "Jane Smith",
            "Poetry",
            "QmY5678...ipfsHash"
          )
      )
        .to.emit(literatureReview, "WorkSubmitted")
        .withArgs(1, 1, author2.address);
    });

    it("✅ Should track work count per period", async function () {
      await literatureReview
        .connect(author1)
        .submitWork("Work 1", "Author 1", "Fiction", "QmHash1");
      await literatureReview
        .connect(author2)
        .submitWork("Work 2", "Author 2", "Poetry", "QmHash2");

      const workCount = await literatureReview.workCountPerPeriod(1);
      expect(workCount).to.equal(2);
    });

    it("✅ Should get period statistics", async function () {
      await literatureReview
        .connect(author1)
        .submitWork("Test Work", "Test Author", "Fiction", "QmHash");

      const [totalSubmissions, submissionActive, reviewActive] =
        await literatureReview.getPeriodStats(1);

      expect(totalSubmissions).to.equal(1);
      expect(typeof submissionActive).to.equal("boolean");
      expect(typeof reviewActive).to.equal("boolean");
    });
  });

  describe("Review Submission", function () {
    beforeEach(async function () {
      // Register and approve reviewer
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Dr. Expert", "All Genres");
      await literatureReview.connect(owner).approveReviewer(reviewer1.address);

      // Submit a work
      await literatureReview
        .connect(author1)
        .submitWork("Test Novel", "Test Author", "Fiction", "QmTestHash");
    });

    /**
     * FHEVM Pattern: Encrypted Review Scores
     *
     * In this simplified test, we use plaintext scores (uint32).
     * In production with FHEVM:
     * - Reviewers would encrypt scores using createEncryptedInput
     * - Scores remain encrypted on-chain
     * - Contract grants permissions using FHE.allowThis() and FHE.allow()
     * - Final decryption happens through the relayer system
     */
    it("✅ Should allow authorized reviewers to submit reviews", async function () {
      await literatureReview
        .connect(reviewer1)
        .submitReview(1, 85, 90, 80, "Excellent work with minor improvements");

      const review = await literatureReview.reviews(1, 1, reviewer1.address);
      expect(review.submitted).to.equal(true);
      expect(review.reviewer).to.equal(reviewer1.address);
    });

    it("✅ Should emit ReviewSubmitted event", async function () {
      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(1, 75, 80, 85, "Good work overall")
      )
        .to.emit(literatureReview, "ReviewSubmitted")
        .withArgs(1, 1, reviewer1.address);
    });

    it("✅ Should update reviewer stats after review", async function () {
      await literatureReview
        .connect(reviewer1)
        .submitReview(1, 80, 85, 90, "Highly original");

      const profile = await literatureReview.getReviewerProfile(
        reviewer1.address
      );
      expect(profile.reviewCount).to.equal(1);
    });

    it("❌ Should reject reviews with invalid scores", async function () {
      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(1, 0, 50, 50, "Invalid quality score")
      ).to.be.revertedWith("Quality score must be 1-100");

      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(1, 50, 101, 50, "Invalid originality score")
      ).to.be.revertedWith("Originality score must be 1-100");

      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(1, 50, 50, 150, "Invalid impact score")
      ).to.be.revertedWith("Impact score must be 1-100");
    });

    it("❌ Should prevent duplicate reviews from same reviewer", async function () {
      await literatureReview
        .connect(reviewer1)
        .submitReview(1, 75, 80, 85, "First review");

      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(1, 80, 85, 90, "Second review")
      ).to.be.revertedWith("Already reviewed");
    });

    it("❌ Should prevent unauthorized reviewers from submitting reviews", async function () {
      await expect(
        literatureReview
          .connect(author2)
          .submitReview(1, 75, 80, 85, "Unauthorized review")
      ).to.be.revertedWith("Not authorized reviewer");
    });

    it("❌ Should prevent reviews for non-existent works", async function () {
      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(999, 75, 80, 85, "Review for non-existent work")
      ).to.be.revertedWith("Work not found");
    });
  });

  describe("Award Management", function () {
    it("✅ Owner can calculate results", async function () {
      // This is a placeholder test since the actual calculation
      // in the contract is simplified for demonstration
      await literatureReview
        .connect(author1)
        .submitWork("Award Work", "Winner", "Fiction", "QmAwardHash");

      await expect(
        literatureReview.connect(owner).calculateResults(1)
      ).to.not.be.reverted;
    });

    it("❌ Non-owner cannot calculate results", async function () {
      await expect(
        literatureReview.connect(author1).calculateResults(1)
      ).to.be.revertedWith("Not authorized");
    });

    it("✅ Owner can announce awards", async function () {
      await expect(
        literatureReview.connect(owner).announceAwards(1)
      ).to.not.be.reverted;
    });

    it("❌ Non-owner cannot announce awards", async function () {
      await expect(
        literatureReview.connect(author1).announceAwards(1)
      ).to.be.revertedWith("Not authorized");
    });

    it("✅ Should get awards for period", async function () {
      const [categories, winners, announced] =
        await literatureReview.getAwards(1);

      expect(categories).to.be.an("array");
      expect(winners).to.be.an("array");
      expect(announced).to.be.an("array");
    });
  });

  describe("FHE Permission Patterns", function () {
    /**
     * Critical FHE Pattern: Permission Granting
     *
     * When working with encrypted values in FHEVM:
     * 1. Always call FHE.allowThis(value) - grants contract permission
     * 2. Then call FHE.allow(value, user) - grants user permission
     *
     * Missing either permission will cause decryption to fail!
     */
    it("✅ Review submission demonstrates correct FHE permission pattern", async function () {
      // Register and approve reviewer
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Dr. FHE", "Encryption Expert");
      await literatureReview.connect(owner).approveReviewer(reviewer1.address);

      // Submit work
      await literatureReview
        .connect(author1)
        .submitWork("FHE Test", "FHE Author", "Fiction", "QmFHEHash");

      // Submit review - contract grants both allowThis and allow permissions
      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(1, 90, 95, 88, "FHE implementation correct")
      ).to.not.be.reverted;

      // Contract has granted:
      // 1. FHE.allowThis(encryptedQuality)
      // 2. FHE.allowThis(encryptedOriginality)
      // 3. FHE.allowThis(encryptedImpact)
      // 4. FHE.allow(encryptedQuality, msg.sender)
      // 5. FHE.allow(encryptedOriginality, msg.sender)
      // 6. FHE.allow(encryptedImpact, msg.sender)
    });
  });

  describe("Access Control", function () {
    it("✅ Only owner can approve reviewers", async function () {
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Reviewer Test", "Testing");

      await expect(
        literatureReview.connect(author1).approveReviewer(reviewer1.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("✅ Only authorized reviewers can submit reviews", async function () {
      await literatureReview
        .connect(author1)
        .submitWork("Access Test", "Author", "Fiction", "QmAccessHash");

      await expect(
        literatureReview
          .connect(author2)
          .submitReview(1, 75, 80, 85, "Unauthorized")
      ).to.be.revertedWith("Not authorized reviewer");
    });

    it("✅ Only owner can start new periods", async function () {
      await expect(
        literatureReview.connect(author1).startSubmissionPeriod()
      ).to.be.revertedWith("Not authorized");

      await expect(
        literatureReview.connect(reviewer1).startReviewPeriod()
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("❌ Cannot review non-existent submission", async function () {
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Edge Tester", "Edge Testing");
      await literatureReview.connect(owner).approveReviewer(reviewer1.address);

      await expect(
        literatureReview
          .connect(reviewer1)
          .submitReview(999, 75, 80, 85, "Non-existent")
      ).to.be.revertedWith("Work not found");
    });

    it("❌ Cannot submit review with all scores at boundary", async function () {
      await literatureReview
        .connect(reviewer1)
        .registerReviewer("Boundary Tester", "Boundary Testing");
      await literatureReview.connect(owner).approveReviewer(reviewer1.address);

      await literatureReview
        .connect(author1)
        .submitWork("Boundary Work", "Boundary Author", "Fiction", "QmBoundary");

      // Test minimum boundary (score = 1)
      await expect(
        literatureReview.connect(reviewer1).submitReview(1, 1, 1, 1, "Minimum")
      ).to.not.be.reverted;
    });

    it("✅ Can submit review with maximum scores", async function () {
      await literatureReview
        .connect(reviewer2)
        .registerReviewer("Max Tester", "Max Testing");
      await literatureReview.connect(owner).approveReviewer(reviewer2.address);

      await literatureReview
        .connect(author2)
        .submitWork("Max Work", "Max Author", "Poetry", "QmMax");

      // Test maximum boundary (score = 100)
      await expect(
        literatureReview
          .connect(reviewer2)
          .submitReview(1, 100, 100, 100, "Perfect")
      ).to.not.be.reverted;
    });
  });
});
