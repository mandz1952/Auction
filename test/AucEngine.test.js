const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('AucEngine', async function () {
	let owner
	let seller
	let buyer

	beforeEach(async function () {
		;[owner, seller, buyer] = await ethers.getSigners()

		const AucEngine = await ethers.getContractFactory('AucEngine', owner)
		auc = await AucEngine.deploy()
		await auc.waitForDeployment()
	})

	it('should be the owner', async function () {
		const cOwner = await auc.owner()
		expect(cOwner).to.eq(owner.address)
	})

	async function getTimestamp(bn) {
		return (await ethers.provider.getBlock(bn)).timestamp
	}

	describe('createAuction', async function () {
		it('create a auction', async function () {
			const duration = 60
			const tx = await auc.createAuction(
				ethers.parseEther('0.0001'),
				3,
				'Test',
				duration
			)
			const cAuction = await auc.auctions(0)
			expect(cAuction.item).to.eq('Test')
			const ts = await getTimestamp(tx.blockNumber)
			expect(cAuction.endsAt).to.eq(ts + duration)
		})

		it('should not allow to create auction', async function () {
			await expect(auc.createAuction(1, 2, 'test', 2)).to.be.revertedWith(
				'incorrect starting price'
			)
		})
	})

	function delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	describe('buy', async function () {
		it('allow to buy', async function () {
			const tx = await auc
				.connect(seller)
				.createAuction(ethers.parseEther('0.0001'), 3, 'Test', 60)

			this.timeout(5000)
			await delay(1000)

			const buyTx = await auc
				.connect(buyer)
				.buy(0, { value: ethers.parseEther('0.0001') })

			const cAuction = await auc.auctions(0)
			const finalPrice = cAuction.finalPrice

			await expect(auc.getPrice(0)).to.be.revertedWith('stopped!')

			await expect(() => buyTx).to.changeEtherBalance(
				seller,
				finalPrice - (finalPrice * 10n) / 100n
			)

			await expect(buyTx)
				.to.emit(auc, 'AuctionEnd')
				.withArgs(0, finalPrice, buyer)

			await expect(
				auc.connect(buyer).buy(0, { value: ethers.parseEther('0.0001') })
			).to.be.revertedWith('stopped!')
		})

		it('should not allow to buy', async function () {
			const tx = await auc
				.connect(seller)
				.createAuction(ethers.parseEther('0.0001'), 3, 'Test', 60)

			await expect(
				auc.connect(buyer).buy(0, { value: ethers.parseEther('0.00001') })
			).to.be.revertedWith('not enough funds!')
		})

		it('should give back a funds', async function () {
			const tx = await auc
				.connect(seller)
				.createAuction(ethers.parseEther('0.0001'), 3, 'Test', 60)
		})
	})
})
