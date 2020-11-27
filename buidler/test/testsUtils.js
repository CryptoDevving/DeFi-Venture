const bre = require("@nomiclabs/buidler");
const { BigNumber } = require("ethers");
const { SPACES, NB_SPACES, CHANCES, NB_CHANCES } = require("../db/playground");
const { expect } = require("chai");
const ethers = bre.ethers;
const utils = ethers.utils;
const NB_MAX_PLAYERS = 8;
const INITIAL_BALANCE = 300;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const STATUS = {
    created: 0,
    started: 1,
    frozen: 2,
    ended: 3
};
const eSpaceType = {
    GENESIS: 0,
    QUARANTINE: 1,
    LIQUIDATION: 2,
    CHANCE: 3,
    ASSET_CLASS_1: 4,
    ASSET_CLASS_2: 5,
    ASSET_CLASS_3: 6,
    ASSET_CLASS_4: 7
};
const SPACE_TYPE = [
    'GENESIS',
    'QUARANTINE',
    'LIQUIDATION',
    'CHANCE',
    'ASSET_CLASS_1',
    'ASSET_CLASS_2',
    'ASSET_CLASS_3',
    'ASSET_CLASS_4'
];

// generic handlers to test exceptions
const shouldFail = {
    then: () => {
        expect(false).to.equal(true, "must fail");
    },
    catch: (e) => {
        expect(true).to.equal(true, "must fail");
    }
};
var avatarCount = 1;

function revertMessage(error) {
    return 'VM Exception while processing transaction: revert ' + error;
}

async function createGameMasterFull() {
    const TokenFactory = await ethers.getContractFactory("GameToken");
    const token = await createGameToken(TokenFactory);
    console.log('token', token.address);
    const AssetsFactory = await ethers.getContractFactory("GameAssets");
    const assets = await createGameAssets(AssetsFactory);
    console.log('assets', assets.address);
    const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
    const marketplace = await createMarketplace(MarketplaceFactory);
    console.log('marketplace', marketplace.address);
    const gameMaster = await createGameMasterBase();
    await gameMaster.setInitialAmount(BigNumber.from(INITIAL_BALANCE));
    const GameContracts = await ethers.getContractFactory("GameContracts");
    const gameContracts = GameContracts.attach(gameMaster.contracts());
    console.log('transfer token ownership to gameContracts');
    await token.transferOwnership(gameContracts.address);
    console.log('transfer assets ownership to gameContracts');
    await assets.transferOwnership(gameContracts.address);
    await gameContracts.setToken(token.address);
    await gameContracts.setAssets(assets.address);
    // await marketplace.setToken(token.address);
    // await marketplace.setAssets(assets.address);
    await marketplace.transferOwnership(gameContracts.address);
    await gameContracts.setMarketplace(marketplace.address);
    gameMaster.tokenAddress = () => gameContracts.getToken();
    gameMaster.setToken = (tokenAddr) => gameContracts.setToken(tokenAddr);
    gameMaster.assetsAddress = () => gameContracts.getAssets();
    gameMaster.marketplaceAddress = () => gameContracts.getMarketplace();
    gameMaster.transferManagerAddress = () => gameContracts.getTransferManager();
    return { gameMaster, token, assets, marketplace };
}

async function createGameMasterBase() {
    const Contracts = await ethers.getContractFactory("GameContracts");
    const contracts = await Contracts.deploy();
    await contracts.deployed();
    const Playground = await ethers.getContractFactory("Playground");
    const playgroundContract = await Playground.deploy(NB_SPACES, SPACES);
    await playgroundContract.deployed();
    await contracts.setPlayground(playgroundContract.address)
    const Chance = await ethers.getContractFactory("Chance");
    const chance = await Chance.deploy(CHANCES);
    await chance.deployed();
    await chance.transferOwnership(contracts.address);
    await contracts.setChances(chance.address)
    const RandomGenerator = await ethers.getContractFactory('RandomGenerator');
    const randomContract = await RandomGenerator.deploy();
    await randomContract.deployed();
    await contracts.setRandomGenerator(randomContract.address)
    const PlayOptions = await ethers.getContractFactory('PlayOptions');
    const playOptions = await PlayOptions.deploy();
    await playOptions.deployed();
    await contracts.setPlayOptions(playOptions.address)
    const TransferManager = await ethers.getContractFactory('TransferManager');
    const transferManager = await TransferManager.deploy();
    await transferManager.deployed();
    await contracts.setTransferManager(transferManager.address)

    const GameMaster = await ethers.getContractFactory("GameMasterForTest");
    const gameMaster = await GameMaster.deploy(
        NB_MAX_PLAYERS,
        ethers.BigNumber.from(INITIAL_BALANCE),
    );
    await gameMaster.deployed();
    await gameMaster.setContracts(contracts.address);
    await playgroundContract.transferOwnership(gameMaster.address);
    gameMaster.getPositionOf = (player) => playgroundContract.positions(player);
    gameMaster.getPlayground = () => playgroundContract.playground();
    gameMaster.getNbPositions = () => playgroundContract.nbPositions();
    return gameMaster;
}

// async function registerPlayers(gameMaster, players) {
//     for (let player of players) {
//         await gameMaster.connect(player).register(utils.formatBytes32String('user' + avatarCount), avatarCount++);
//     }
// }

async function registerPlayers(gameMaster, players) {
    let tokenContract;
    let assetsContract;
    const TokenFactory = await ethers.getContractFactory("GameToken");
    const token = await gameMaster.tokenAddress();
    if (token !== 0) {
        tokenContract = await TokenFactory.attach(token);
        await tokenContract.deployed();
    }
    const AssetsFactory = await ethers.getContractFactory("GameAssets");
    const assets = await gameMaster.assetsAddress();
    if (assets !== 0) {
        assetsContract = await AssetsFactory.attach(assets);
        await assetsContract.deployed();
    }
    const marketplaceAddr = await gameMaster.marketplaceAddress();
    const GameContracts = await ethers.getContractFactory("GameContracts");
    const gameContracts = GameContracts.attach(gameMaster.contracts());
    await gameContracts.deployed();
    const TransferManager = await ethers.getContractFactory("TransferManager");
    const transferManager = TransferManager.attach(gameContracts.getTransferManager());
    await transferManager.deployed();
    for (let player of players) {
        if (tokenContract) {
            await tokenContract.connect(player).approveMax(transferManager.address);
            if (marketplaceAddr) {
                await tokenContract.connect(player).approveMax(marketplaceAddr);
            }
        }
        if (assetsContract) {
            await assetsContract.connect(player).setApprovalForAll(transferManager.address, true);
            if (marketplaceAddr) {
                await assetsContract.connect(player).setApprovalForAll(marketplaceAddr, true);
            }
        }
        await gameMaster.connect(player).register(utils.formatBytes32String('user' + avatarCount), avatarCount++);
    }
}

async function startGame(gameMaster) {
    await gameMaster.start();
}


async function playTurn(gameMaster, signer) {
    return new Promise(async(resolve) => {
        let filter = gameMaster.filters.RolledDices(signer.address);
        gameMaster.once(filter, async(player, dice1, dice2, cardId, newPosition, options) => {
            console.log('RolledDices', player, dice1, dice2, cardId, newPosition, options);
            await gameMaster.setOptions(255);
            await gameMaster.connect(signer).play(1);
            resolve([dice1, dice2]);
        });
        await gameMaster.connect(signer).rollDices();
    });
}

function checkDice(dice) {
    expect(dice).to.be.lessThan(7, 'dices cannot exceed 6');
    expect(dice).to.be.greaterThan(0, 'dices cannot be under 1');
}

function extractSpaceCode(playground, spaceId) {
    const idxStart = playground.length - 2 * (spaceId);
    return playground.slice(idxStart - 2, idxStart);
}

async function createGameToken(TokenFactory) {
    const gameToken = await TokenFactory.deploy();
    await gameToken.deployed();
    return gameToken;
}

async function createGameAssets(AssetsFactory) {
    const gameAssets = await AssetsFactory.deploy();
    await gameAssets.deployed();
    return gameAssets;
}

async function createMarketplace(MarketplaceFactory) {
    const marketplace = await MarketplaceFactory.deploy();
    await marketplace.deployed();
    return marketplace;
}

function decodePlayground(playground, nbSpaces) {
    console.log('decodePlayground');
    for (let i = 0; i < nbSpaces; i++) {
        const spaceCodeStr = '0x' + extractSpaceCode(playground, i);
        const spaceCode = parseInt(spaceCodeStr, 16);
        const type = spaceCode & 0x7;
        const isAsset = ((type >= eSpaceType.ASSET_CLASS_1) && (type <= eSpaceType.ASSET_CLASS_4));
        const assetId = spaceCode >> 3;
        const assetClass = isAsset ? type - eSpaceType.ASSET_CLASS_1 + 1 : 0;
        const assetPrice = isAsset ? 50 * assetClass : 0;
        const productPrice = isAsset ? 15 * assetClass : 0;
        console.log(`#${i} ${SPACE_TYPE[type]} ${isAsset ? 'asset #' + assetId + ', price:' + assetPrice + ',bill:' + productPrice : ''}`);
    }
}

decodePlayground(SPACES, NB_SPACES);

module.exports = {
    createGameMasterFull,
    STATUS,
    NB_MAX_PLAYERS,
    INITIAL_BALANCE,
    NULL_ADDRESS,
    shouldFail,
    revertMessage,
    registerPlayers,
    startGame,
    checkDice,
    extractSpaceCode,
    playTurn,
    createGameToken,
    createGameAssets,
    createMarketplace,
    avatarCount
};