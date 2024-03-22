import { ethers } from 'hardhat';
import { Fixture } from 'ethereum-waffle';
import { MockERC20, VestingContract } from '../../dist/types';
import { BigNumber } from 'ethers';

interface ContractFixture {
  erc20: MockERC20;
  vesting: VestingContract;
}

export const integrationFixture: Fixture<ContractFixture> =
  async function (): Promise<ContractFixture> {
    const users = await ethers.getSigners();
    
    // nft
    const erc20 = await (
      await ethers.getContractFactory('MockERC20')
    ).deploy(
      BigNumber.from(10).pow(18).mul(1000000000).toString(),
    ) as MockERC20;

    await erc20.deployed();



    const vesting = await (
      await ethers.getContractFactory('VestingContract')
    ).deploy(
      erc20.address,
      users[0].address,
      users[1].address,
    ) as VestingContract;

    await vesting.deployed();

    return {
      erc20,
      vesting
    };
  };
