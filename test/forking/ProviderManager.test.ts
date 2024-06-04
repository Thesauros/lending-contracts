import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  ProviderManager__factory,
  ProviderManager,
} from '../../typechain-types';

describe('ProviderManager', async () => {
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;

  let WETH: string; // WETH address on Arbitrum mainnet
  let USDC: string; // USDC.e address on Arbitrum mainnet
  let iETH: string; // Deforce iETH address on Arbitrum mainnet
  let cUSDC: string; // Comet cUSDC.e on Arbitrum Mainnet

  let providerManager: ProviderManager;

  let CompoundProviderName: string;
  let DForceProviderName: string;

  before(async () => {
    [deployer, alice] = await ethers.getSigners();

    WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
    USDC = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
    iETH = '0xEe338313f022caee84034253174FA562495dcC15';
    cUSDC = '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA';

    CompoundProviderName = 'Compound_V3_Arbitrum';
    DForceProviderName = 'DForce_Arbitrum';
  });

  beforeEach(async () => {
    providerManager = await new ProviderManager__factory(deployer).deploy();
  });

  describe('constructor', async () => {
    it('Should initialize with correct admin', async () => {
      expect(
        await providerManager.hasRole(
          await providerManager.DEFAULT_ADMIN_ROLE(),
          deployer.address
        )
      ).to.be.true;
    });
  });

  describe('setProtocolToken', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        providerManager
          .connect(alice)
          .setProtocolToken(DForceProviderName, WETH, iETH)
      ).to.be.revertedWithCustomError(
        providerManager,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should set the protocol token', async () => {
      let tx = await providerManager.setProtocolToken(
        DForceProviderName,
        WETH,
        iETH
      );

      let providers = await providerManager.getProviders();

      expect(
        await providerManager.getProtocolToken(DForceProviderName, WETH)
      ).to.be.equal(iETH);
      expect(providers[0]).to.be.equal(DForceProviderName);

      // Should emit ProtocolTokenChanged event
      await expect(tx)
        .to.emit(providerManager, 'ProtocolTokenChanged')
        .withArgs(DForceProviderName, WETH, iETH);
    });
  });

  describe('setProtocolMarket', async () => {
    it('Should revert when called by non-admin', async () => {
      await expect(
        providerManager
          .connect(alice)
          .setProtocolMarket(CompoundProviderName, WETH, USDC, cUSDC)
      ).to.be.revertedWithCustomError(
        providerManager,
        'ProtocolAccessControl__CallerIsNotAdmin'
      );
    });
    it('Should set the protocol token', async () => {
      let tx = await providerManager.setProtocolMarket(
        CompoundProviderName,
        WETH,
        USDC,
        cUSDC
      );

      let providers = await providerManager.getProviders();

      expect(
        await providerManager.getProtocolMarket(
          CompoundProviderName,
          WETH,
          USDC
        )
      ).to.be.equal(cUSDC);
      expect(providers[0]).to.be.equal(CompoundProviderName);

      // Should emit ProtocolMarketChanged event
      await expect(tx)
        .to.emit(providerManager, 'ProtocolMarketChanged')
        .withArgs(CompoundProviderName, WETH, USDC, cUSDC);
    });
  });
});
