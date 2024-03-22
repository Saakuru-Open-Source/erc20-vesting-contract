import dotenv from 'dotenv';

dotenv.config();

export default {
  ERC20: process.env.ERC20,
  OWNER: process.env.OWNER,
  RECOVERY_WALLET: process.env.RECOVERY_WALLET
};