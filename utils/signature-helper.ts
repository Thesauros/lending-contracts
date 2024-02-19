import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

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
    ["string", "bytes32", "bytes32"],
    ["\x19\x01", domainSeperator, structHash]
  );
  return digest;
}

export async function getWithdrawStructHash(permit: {
  owner: string;
  operator: string;
  receiver: string;
  amount: bigint;
  nonce: bigint;
  deadline: number;
  actionArgsHash: string;
}) {
  const PERMIT_WITHDRAW_TYPEHASH = ethers.solidityPackedKeccak256(
    ["string"],
    [
      "PermitWithdraw(address owner,address operator,address receiver,uint256 amount,uint256 nonce,uint256 deadline,bytes32 actionArgsHash)",
    ]
  );
  const encodedData = abiCoder.encode(
    [
      "bytes32",
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
    ],
    [
      PERMIT_WITHDRAW_TYPEHASH,
      permit.owner,
      permit.operator,
      permit.receiver,
      permit.amount,
      permit.nonce,
      permit.deadline,
      permit.actionArgsHash,
    ]
  );
  const hash = ethers.keccak256(encodedData);
  return hash;
}
