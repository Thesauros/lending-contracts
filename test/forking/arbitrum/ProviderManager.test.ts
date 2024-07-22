import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  ProviderManager__factory,
  ProviderManager,
} from '../../../typechain-types';
import {
  tokenAddresses,
  cometTokens,
  dforceTokens,
  DEFAULT_ADMIN_ROLE,
} from '../../../utils/helper';

describe('ProviderManager', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;

  let wethAddress: string;
  let usdcAddress: string;
  let iEthAddress: string;
  let cUsdcAddress: string;

  let providerManager: ProviderManager;

  let CompoundProviderName: string;
  let DForceProviderName: string;

  before(async () => {
    [deployer, alice] = await ethers.getSigners();

    wethAddress = tokenAddresses.arbitrum.WETH;
    usdcAddress = tokenAddresses.arbitrum.USDC;
    iEthAddress = dforceTokens.iETH;
    cUsdcAddress = cometTokens.cUSDC;

    CompoundProviderName = 'Compound_V3_Arbitrum';
    DForceProviderName = 'DForce_Arbitrum';
  });

  beforeEach(async () => {
    providerManager = await new ProviderManager__factory(deployer).deploy();
  });

  describe('constructor', async () => {
    it('Should initialize with correct admin', async () => {
      expect(
        await providerManager.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)
      ).to.be.true;
    });
  });

  describe('setProtocolToken', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        providerManager
          .connect(alice)
          .setProtocolToken(DForceProviderName, wethAddress, iEthAddress)
      ).to.be.revertedWithCustomError(
        providerManager,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should set the protocol token', async () => {
      let tx = await providerManager.setProtocolToken(
        DForceProviderName,
        wethAddress,
        iEthAddress
      );

      let providers = await providerManager.getProviders();

      expect(
        await providerManager.getProtocolToken(DForceProviderName, wethAddress)
      ).to.be.equal(iEthAddress);
      expect(providers[0]).to.be.equal(DForceProviderName);

      // Should emit ProtocolTokenChanged event
      await expect(tx)
        .to.emit(providerManager, 'ProtocolTokenChanged')
        .withArgs(DForceProviderName, wethAddress, iEthAddress);
    });
  });

  describe('setProtocolMarket', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        providerManager
          .connect(alice)
          .setProtocolMarket(
            CompoundProviderName,
            wethAddress,
            usdcAddress,
            cUsdcAddress
          )
      ).to.be.revertedWithCustomError(
        providerManager,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should set the protocol token', async () => {
      let tx = await providerManager.setProtocolMarket(
        CompoundProviderName,
        wethAddress,
        usdcAddress,
        cUsdcAddress
      );

      let providers = await providerManager.getProviders();

      expect(
        await providerManager.getProtocolMarket(
          CompoundProviderName,
          wethAddress,
          usdcAddress
        )
      ).to.be.equal(cUsdcAddress);
      expect(providers[0]).to.be.equal(CompoundProviderName);

      // Should emit ProtocolMarketChanged event
      await expect(tx)
        .to.emit(providerManager, 'ProtocolMarketChanged')
        .withArgs(CompoundProviderName, wethAddress, usdcAddress, cUsdcAddress);
    });
  });
});
