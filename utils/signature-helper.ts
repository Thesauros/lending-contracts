import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

let abiCoder = ethers.AbiCoder.defaultAbiCoder();

export async function signMessage(signer: SignerWithAddress, message: string) {
  const signature = await signer.signMessage(ethers.toBeArray(message));
  const { v, r, s } = ethers.Signature.from(signature);
  return { v, r, s };
}

export async function getHashTypedData(
  domainSeperator: string,
  structHash: string
) {
  const digest = ethers.solidityPackedKeccak256(
    ['string', 'bytes32', 'bytes32'],
    ['\x19\x01', domainSeperator, structHash]
  );
  return digest;
}

export async function getStructHash(permit: {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: number;
}) {
  const PERMIT_TYPEHASH = ethers.solidityPackedKeccak256(
    ['string'],
    [
      'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)',
    ]
  );
  const encodedData = abiCoder.encode(
    [
      'bytes32',
      'address',
      'address',
      'uint256',
      'uint256',
      'uint256',
    ],
    [
      PERMIT_TYPEHASH,
      permit.owner,
      permit.spender,
      permit.value,
      permit.nonce,
      permit.deadline,
    ]
  );
  const hash = ethers.keccak256(encodedData);
  return hash;
}
