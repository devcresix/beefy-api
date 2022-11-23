const BigNumber = require('bignumber.js');
const { MultiCall } = require('eth-multicall');
const { ethwWeb3: web3, multicallAddress } = require('../../../../utils/web3');

const MasterChef = require('../../../../abis/ethw/LFGMasterchef.json');
const ERC20 = require('../../../../abis/ERC20.json');
const fetchPrice = require('../../../../utils/fetchPrice');
const pools = require('../../../../data/ethw/lfgLpPools.json');
const { compound } = require('../../../../utils/compound');
const { BASE_HPY, ETHW_CHAIN_ID } = require('../../../../constants');
const { getTradingFeeApr } = require('../../../../utils/getTradingFeeApr');
import { getFarmWithTradingFeesApy } from '../../../../utils/getFarmWithTradingFeesApy';
import { PCS_LPF } from '../../../../constants';
import { getContract, getContractWithProvider } from '../../../../utils/contractHelper';
import { getTotalPerformanceFeeForVault } from '../../../vaults/getVaultFees';

const masterchef = '0x0cd5bB382De57d92088E79da2ed3893A6326C112';
const oracle = 'tokens';
const oracleId = 'LFG';
const DECIMALS = '1e18';
const secondsPerBlock = 3;
const secondsPerYear = 31536000;

const pancakeLiquidityProviderFee = PCS_LPF;

export const getLFGLPApys = async () => {
  let apys = {};
  let apyBreakdowns = {};

  const tokenPrice = await fetchPrice({ oracle, id: oracleId });
  const { blockRewards, totalAllocPoint } = await getMasterChefData();
  const { balances, allocPoints } = await getPoolsData(pools);

  const pairAddresses = pools.map(pool => pool.address);
  const tradingAprs = await getTradingFeeApr('', pairAddresses, pancakeLiquidityProviderFee);

  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];

    const beefyPerformanceFee = getTotalPerformanceFeeForVault(pool.name);
    const shareAfterBeefyPerformanceFee = 1 - beefyPerformanceFee;

    const lpPrice = await fetchPrice({ oracle: 'lps', id: pool.name });
    const totalStakedInUsd = balances[i].times(lpPrice).dividedBy('1e18');

    const poolBlockRewards = blockRewards.times(allocPoints[i]).dividedBy(totalAllocPoint);

    const yearlyRewards = poolBlockRewards.dividedBy(secondsPerBlock).times(secondsPerYear);
    const yearlyRewardsInUsd = yearlyRewards.times(tokenPrice).dividedBy(DECIMALS);

    const simpleApy = yearlyRewardsInUsd.dividedBy(totalStakedInUsd);
    // console.log(pool.name, totalStakedInUsd.valueOf(), yearlyRewards.valueOf(), yearlyRewardsInUsd.valueOf(),  simpleApy.valueOf(), allocPoints[i].valueOf(), totalAllocPoint.valueOf(), poolBlockRewards.valueOf())
    const vaultApr = simpleApy.times(shareAfterBeefyPerformanceFee);
    const vaultApy = compound(simpleApy, BASE_HPY, 1, shareAfterBeefyPerformanceFee);
    const tradingApr = tradingAprs[pool.address.toLowerCase()] ?? new BigNumber(0);
    const totalApy = getFarmWithTradingFeesApy(
      simpleApy,
      tradingApr,
      BASE_HPY,
      1,
      shareAfterBeefyPerformanceFee
    );
    const legacyApyValue = { [pool.name]: totalApy };
    // Add token to APYs object
    apys = { ...apys, ...legacyApyValue };

    // Create reference for breakdown /apy
    const componentValues = {
      [pool.name]: {
        vaultApr: vaultApr.toNumber(),
        compoundingsPerYear: BASE_HPY,
        beefyPerformanceFee: beefyPerformanceFee,
        vaultApy: vaultApy,
        lpFee: pancakeLiquidityProviderFee,
        tradingApr: tradingApr.toNumber(),
        totalApy: totalApy,
      },
    };
    // Add token to APYs object
    apyBreakdowns = { ...apyBreakdowns, ...componentValues };
  }

  // Return both objects for later parsing
  return {
    apys,
    apyBreakdowns,
  };
};

const getMasterChefData = async () => {
  const masterchefContract = getContractWithProvider(MasterChef, masterchef, web3);
  const blockRewards = new BigNumber(await masterchefContract.methods.lfgPerBlock().call());
  const totalAllocPoint = new BigNumber(await masterchefContract.methods.totalAllocPoint().call());
  return { blockRewards, totalAllocPoint };
};

const getPoolsData = async pools => {
  const masterchefContract = getContract(MasterChef, masterchef);
  const multicall = new MultiCall(web3, multicallAddress(ETHW_CHAIN_ID));
  const balanceCalls = [];
  const allocPointCalls = [];
  pools.forEach(pool => {
    const tokenContract = getContract(ERC20, pool.address);
    balanceCalls.push({
      balance: tokenContract.methods.balanceOf(masterchef),
    });
    allocPointCalls.push({
      allocPoint: masterchefContract.methods.poolInfo(pool.poolId),
    });
  });

  const res = await multicall.all([balanceCalls, allocPointCalls]);

  const balances = res[0].map(v => new BigNumber(v.balance));
  const allocPoints = res[1].map(v => v.allocPoint['2']);
  return { balances, allocPoints };
};
