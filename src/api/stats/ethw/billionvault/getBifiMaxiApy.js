const BigNumber = require('bignumber.js');
const { ethwWeb3: web3 } = require('../../../../utils/web3');

const IRewardPool = require('../../../../abis/IRewardPool.json');
const fetchPrice = require('../../../../utils/fetchPrice');
const { getTotalStakedInUsd } = require('../../../../utils/getTotalStakedInUsd');
const { compound } = require('../../../../utils/compound');
const { DAILY_HPY } = require('../../../../constants');
const { getContractWithProvider } = require('../../../../utils/contractHelper');
const { getTotalPerformanceFeeForVault } = require('../../../vaults/getVaultFees');

const BIFI = '0x0c9f28FBdFd79f7C00B805d8c63D053c146d282c';
const REWARDS = '0x2B7c8977087420E0f29069B4DB74bF35E23FAA8a';
const ORACLE = 'tokens';
const ORACLE_ID = 'BHC';
const DECIMALS = '1e18';
const BLOCKS_PER_DAY = 28800;

const getBifiMaxiApy = async () => {
  const [yearlyRewardsInUsd, totalStakedInUsd] = await Promise.all([
    getYearlyRewardsInUsd(),
    getTotalStakedInUsd(REWARDS, BIFI, ORACLE, ORACLE_ID, DECIMALS),
  ]);

  const simpleApy = yearlyRewardsInUsd.dividedBy(totalStakedInUsd);
  const shareAfterBeefyPerformanceFee = 1 - getTotalPerformanceFeeForVault('bhc-maxi');
  const apy = compound(simpleApy, DAILY_HPY, 1, shareAfterBeefyPerformanceFee);

  // devcresix
  return { 'bhc-maxi': apy };
};

const getYearlyRewardsInUsd = async () => {
  const ethwPrice = await fetchPrice({ oracle: 'tokens', id: 'ETHW' });

  const rewardPool = getContractWithProvider(IRewardPool, REWARDS, web3);
  const rewardRate = new BigNumber(await rewardPool.methods.rewardRate().call());
  const yearlyRewards = rewardRate.times(3).times(BLOCKS_PER_DAY).times(365);
  const yearlyRewardsInUsd = yearlyRewards.times(ethwPrice).dividedBy(DECIMALS);

  return yearlyRewardsInUsd;
};

module.exports = getBifiMaxiApy;
