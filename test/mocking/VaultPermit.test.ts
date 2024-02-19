import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20__factory,
  MockERC20,
  VaultRebalancer__factory,
  VaultRebalancer,
  MockProviderA__factory,
  MockProviderA,
} from "../../typechain-types";
import {
  getHashTypedData,
  getWithdrawStructHash,
  signMessage,
} from "../../utils/signature-helper";
import { moveTime } from "../../utils/move-time";

describe("VaultPermit", async () => {
  let deployer: SignerWithAddress;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let receiver: SignerWithAddress;

  let PRECISION_CONSTANT: bigint;

  let initAmount: bigint;
  let withdrawFeePercent: bigint;
  let approveAmount: bigint;
  let depositAmount: bigint;

  let assetDecimals: bigint;

  let mainAsset: MockERC20; // testUSDC
  let providerA: MockProviderA;
  let vaultRebalancer: VaultRebalancer;

  before(async () => {
    [deployer, owner, operator, receiver] = await ethers.getSigners();

    PRECISION_CONSTANT = ethers.parseEther("1");

    initAmount = ethers.parseUnits("1", 6);
    withdrawFeePercent = ethers.parseEther("0.1"); // 10%
    approveAmount = ethers.parseUnits("500", 6);
    depositAmount = ethers.parseUnits("1000", 6);

    assetDecimals = 6n;
  });

  beforeEach(async () => {
    mainAsset = await new MockERC20__factory(deployer).deploy(
      "testUSDC",
      "tUSDC",
      assetDecimals
    );

    await mainAsset.mint(deployer.address, initAmount);
    await mainAsset.mint(owner.address, depositAmount);

    providerA = await new MockProviderA__factory(deployer).deploy();

    // Rebalancer and Treasury is the deployer for testing purposes
    vaultRebalancer = await new VaultRebalancer__factory(deployer).deploy(
      await mainAsset.getAddress(),
      deployer.address,
      "Glia tUSDC",
      "gtUSDC",
      [await providerA.getAddress()],
      withdrawFeePercent,
      deployer.address
    );

    await mainAsset.approve(await vaultRebalancer.getAddress(), initAmount);
    await vaultRebalancer.initializeVaultShares(initAmount);

    await mainAsset
      .connect(owner)
      .approve(await vaultRebalancer.getAddress(), depositAmount);
  });

  describe("increaseWithdrawAllowance", async () => {
    it("Should revert when operator is invalid", async () => {
      await expect(
        vaultRebalancer
          .connect(owner)
          .increaseWithdrawAllowance(
            ethers.ZeroAddress,
            receiver.address,
            approveAmount
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__AddressZero"
      );
    });
    it("Should revert when receiver is invalid", async () => {
      await expect(
        vaultRebalancer
          .connect(owner)
          .increaseWithdrawAllowance(
            operator.address,
            ethers.ZeroAddress,
            approveAmount
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__AddressZero"
      );
    });
    it("Should increase withdraw allowance", async () => {
      expect(
        await vaultRebalancer.withdrawAllowance(
          owner.address,
          operator.address,
          receiver.address
        )
      ).to.equal(0);

      let tx = await vaultRebalancer
        .connect(owner)
        .increaseWithdrawAllowance(
          operator.address,
          receiver.address,
          approveAmount
        );

      expect(
        await vaultRebalancer.withdrawAllowance(
          owner.address,
          operator.address,
          receiver.address
        )
      ).to.equal(approveAmount);
      expect(tx)
        .to.emit(vaultRebalancer, "WithdrawApproval")
        .withArgs(
          owner.address,
          operator.address,
          receiver.address,
          approveAmount
        );
    });
  });
  describe("decreaseWithdrawAllowance", async () => {
    it("Should revert when amount is invalid", async () => {
      let decreaseAmount = approveAmount * 2n;
      await vaultRebalancer
        .connect(owner)
        .increaseWithdrawAllowance(
          operator.address,
          receiver.address,
          approveAmount
        );
      await expect(
        vaultRebalancer
          .connect(owner)
          .decreaseWithdrawAllowance(
            operator.address,
            receiver.address,
            decreaseAmount
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__AllowanceBelowZero"
      );
    });
    it("Should decrease withdraw allowance", async () => {
      let decreaseAmount = approveAmount / 2n;
      await vaultRebalancer
        .connect(owner)
        .increaseWithdrawAllowance(
          operator.address,
          receiver.address,
          approveAmount
        );

      await vaultRebalancer
        .connect(owner)
        .decreaseWithdrawAllowance(
          operator.address,
          receiver.address,
          decreaseAmount
        );
      expect(
        await vaultRebalancer.withdrawAllowance(
          owner.address,
          operator.address,
          receiver.address
        )
      ).to.equal(approveAmount - decreaseAmount);
    });
  });
  describe("approve", async () => {
    it("Should increase withdraw allowance", async () => {
      expect(
        await vaultRebalancer.withdrawAllowance(
          owner.address,
          receiver.address,
          receiver.address
        )
      ).to.equal(0);
      expect(
        await vaultRebalancer.allowance(owner.address, receiver.address)
      ).to.equal(0);

      let tx = await vaultRebalancer
        .connect(owner)
        .approve(receiver.address, approveAmount);

      expect(
        await vaultRebalancer.withdrawAllowance(
          owner.address,
          receiver.address,
          receiver.address
        )
      ).to.equal(approveAmount);
      expect(
        await vaultRebalancer.allowance(owner.address, receiver.address)
      ).to.equal(approveAmount);

      expect(tx)
        .to.emit(vaultRebalancer, "Approval")
        .withArgs(owner.address, receiver.address, approveAmount);
    });
  });
  describe("_spendWithdrawAllowance", async () => {
    it("Should revert when the allowance is insufficient", async () => {
      await vaultRebalancer
        .connect(owner)
        .deposit(depositAmount, owner.address);

      await vaultRebalancer
        .connect(owner)
        .increaseWithdrawAllowance(
          operator.address,
          receiver.address,
          approveAmount
        );

      await expect(
        vaultRebalancer
          .connect(operator)
          .withdraw(approveAmount, operator.address, owner.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__InsufficientWithdrawAllowance"
      );
      await expect(
        vaultRebalancer
          .connect(operator)
          .withdraw(depositAmount, receiver.address, owner.address)
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__InsufficientWithdrawAllowance"
      );
    });
    it("Should spend the allowance after withdrawal", async () => {
      await vaultRebalancer
        .connect(owner)
        .deposit(depositAmount, owner.address);

      await vaultRebalancer
        .connect(owner)
        .increaseWithdrawAllowance(
          operator.address,
          receiver.address,
          approveAmount
        );

      await vaultRebalancer
        .connect(operator)
        .withdraw(approveAmount, receiver.address, owner.address);

      expect(
        await vaultRebalancer.withdrawAllowance(
          owner.address,
          operator.address,
          receiver.address
        )
      ).to.equal(0);
    });
  });
  describe("permitWithdraw", async () => {
    it("Should revert when the signature is invalid", async () => {
      await vaultRebalancer
        .connect(owner)
        .deposit(depositAmount, owner.address);

      let pretendedActionArgsHash = ethers.solidityPackedKeccak256(
        ["uint256"],
        [1]
      );

      // @ts-ignore: Object is possibly 'null'.
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp;

      let permit = {
        owner: owner.address,
        operator: operator.address,
        receiver: receiver.address,
        amount: approveAmount,
        nonce: await vaultRebalancer.nonces(owner.address),
        deadline: timestamp + 86400,
        actionArgsHash: pretendedActionArgsHash,
      };

      let digest = await getHashTypedData(
        await vaultRebalancer.DOMAIN_SEPARATOR(),
        await getWithdrawStructHash(permit)
      );

      const { v, r, s } = await signMessage(owner, digest);

      // invalid operator
      await expect(
        vaultRebalancer
          .connect(receiver)
          .permitWithdraw(
            owner.address,
            receiver.address,
            approveAmount,
            permit.deadline,
            permit.actionArgsHash,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__InvalidSignature"
      );
      // invalid owner
      await expect(
        vaultRebalancer
          .connect(operator)
          .permitWithdraw(
            receiver.address,
            receiver.address,
            approveAmount,
            permit.deadline,
            permit.actionArgsHash,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__InvalidSignature"
      );
      // invalid receiver
      await expect(
        vaultRebalancer
          .connect(operator)
          .permitWithdraw(
            owner.address,
            operator.address,
            approveAmount,
            permit.deadline,
            permit.actionArgsHash,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__InvalidSignature"
      );
      // invalid amount
      await expect(
        vaultRebalancer
          .connect(operator)
          .permitWithdraw(
            owner.address,
            receiver.address,
            approveAmount + 1n,
            permit.deadline,
            permit.actionArgsHash,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__InvalidSignature"
      );
      // invalid deadline
      await expect(
        vaultRebalancer
          .connect(operator)
          .permitWithdraw(
            owner.address,
            receiver.address,
            approveAmount,
            permit.deadline + 1,
            permit.actionArgsHash,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__InvalidSignature"
      );
    });
    it("Should revert when the deadline is expired", async () => {
      await vaultRebalancer
        .connect(owner)
        .deposit(depositAmount, owner.address);

      let pretendedActionArgsHash = ethers.solidityPackedKeccak256(
        ["uint256"],
        [1]
      );

      // @ts-ignore: Object is possibly 'null'.
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp;

      let permit = {
        owner: owner.address,
        operator: operator.address,
        receiver: receiver.address,
        amount: approveAmount,
        nonce: await vaultRebalancer.nonces(owner.address),
        deadline: timestamp + 86400,
        actionArgsHash: pretendedActionArgsHash,
      };

      let digest = await getHashTypedData(
        await vaultRebalancer.DOMAIN_SEPARATOR(),
        await getWithdrawStructHash(permit)
      );

      const { v, r, s } = await signMessage(owner, digest);

      await moveTime(86401);

      await expect(
        vaultRebalancer
          .connect(operator)
          .permitWithdraw(
            owner.address,
            receiver.address,
            approveAmount,
            permit.deadline,
            permit.actionArgsHash,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        vaultRebalancer,
        "VaultPermit__ExpiredDeadline"
      );
    });
    it("Should withdraw with permit", async () => {
      let previousBalanceReceiver = await mainAsset.balanceOf(receiver.address);
      await vaultRebalancer
        .connect(owner)
        .deposit(depositAmount, owner.address);

      let pretendedActionArgsHash = ethers.solidityPackedKeccak256(
        ["uint256"],
        [1]
      );

      // @ts-ignore: Object is possibly 'null'.
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp;

      let permit = {
        owner: owner.address,
        operator: operator.address,
        receiver: receiver.address,
        amount: approveAmount,
        nonce: await vaultRebalancer.nonces(owner.address),
        deadline: timestamp + 86400,
        actionArgsHash: pretendedActionArgsHash,
      };

      let digest = await getHashTypedData(
        await vaultRebalancer.DOMAIN_SEPARATOR(),
        await getWithdrawStructHash(permit)
      );

      const { v, r, s } = await signMessage(owner, digest);

      await vaultRebalancer
        .connect(operator)
        .permitWithdraw(
          owner.address,
          receiver.address,
          approveAmount,
          permit.deadline,
          permit.actionArgsHash,
          v,
          r,
          s
        );

      expect(
        await vaultRebalancer.withdrawAllowance(
          owner.address,
          operator.address,
          receiver.address
        )
      ).to.equal(approveAmount);

      await vaultRebalancer
        .connect(operator)
        .withdraw(approveAmount, receiver.address, owner.address);

      let expectedAmount =
        previousBalanceReceiver +
        approveAmount -
        (approveAmount * withdrawFeePercent) / PRECISION_CONSTANT;

      expect(await mainAsset.balanceOf(receiver.address)).to.equal(
        expectedAmount
      );
    });
  });
});
