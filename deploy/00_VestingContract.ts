import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import config from '../config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy('VestingContract', {
    from: deployer,
    args: [
      config.ERC20,
      config.OWNER,
      config.RECOVERY_WALLET,
    ],
    log: true,
    skipIfAlreadyDeployed: true,
    contract: 'VestingContract',
  });
};

export default func;
func.id = 'VestingContract';
func.tags = ['hardhat', 'v1'];
func.dependencies = [];
