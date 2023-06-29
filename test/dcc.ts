import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { toWei } from "web3-utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Web3Eth } from "web3";
import { Web3 } from "web3";

describe("Dcc", function () {
    let owner: SignerWithAddress,
        dev: SignerWithAddress,
        spender: SignerWithAddress,
        team: SignerWithAddress,
        trader2: SignerWithAddress,
        resever: SignerWithAddress;
    describe("Test contract", function () {
        it("Test name symbol", async function () {
            // deploy DCC contract
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy("100", "1", "1", "1", "1", "1", "1");
            expect(await dcc.name()).to.equal("Dcc");
            expect(await dcc.symbol()).to.equal("Dcc");
            expect(await dcc.MAX_SUPPLY()).to.eq(toWei(1000000000, "ether"));
        });
        it("Test black list", async function () {
            [owner, dev, spender, team, trader2, resever] =
                await ethers.getSigners();
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy(
                "10",
                "48",
                "12",
                "36",
                "12",
                "36",
                "12"
            );
            await dcc.transfer(dev.address, toWei(100, "ether"));

            await dcc.connect(dev).approve(dev.address, toWei(100, "ether"));
            await dcc
                .connect(dev)
                .transferFrom(dev.address, team.address, toWei(1, "ether"));
            await dcc.addTransferBlacklist(dev.address);
            await expect(
                dcc.transfer(dev.address, toWei(100, "ether"))
            ).to.be.revertedWith("DCC: transfer to the blacklisted address");
            await expect(
                dcc
                    .connect(dev)
                    .transferFrom(dev.address, team.address, toWei(1, "ether"))
            ).to.be.revertedWith("DCC: transfer from the blacklisted address");
            await dcc.removeTransferBlacklist(dev.address);
            await dcc.transfer(dev.address, toWei(100, "ether"));
            await dcc
                .connect(dev)
                .transferFrom(dev.address, team.address, toWei(1, "ether"));
        });
        it("Test team lock", async function () {
            [owner, dev, spender, team, trader2, resever] =
                await ethers.getSigners();
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy(
                "10",
                "48",
                "12",
                "36",
                "12",
                "36",
                "12"
            );
            await expect(dcc.claimTeam()).to.be.revertedWith("!0");
            await dcc.setTeamAddress(team.address);
            expect(await dcc.teamAddress()).to.eq(team.address);
            let clamin = await dcc.claimed(team.address);
            expect(clamin).to.eq(0);
            let cycleTeam = await dcc.getCycle();
            expect(cycleTeam).to.eq(0);
            await time.increase(120);
            cycleTeam = await dcc.getCycle();
            expect(cycleTeam).to.eq(12);
            expect(await dcc.balanceOf(team.address)).to.eq(0);
            await dcc.claimTeam();
            expect(await dcc.balanceOf(team.address)).to.eq(
                "62500000000000000000000000"
            );
            clamin = await dcc.claimed(team.address);
            expect(clamin).to.eq(12);
            await dcc.setTeamAddress(trader2.address);
            clamin = await dcc.claimed(trader2.address);
            expect(clamin).to.eq(12);

            clamin = await dcc.claimed(team.address);
            expect(clamin).to.eq(0);
        });

        it("Test resever lock", async function () {
            [owner, dev, spender, team, trader2, resever] =
                await ethers.getSigners();
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy(
                "10",
                "48",
                "12",
                "36",
                "12",
                "36",
                "12"
            );
            await expect(dcc.claimReserve()).to.be.revertedWith("!0");
            await dcc.setReserveAddress(resever.address);
            expect(await dcc.reserveAddress()).to.eq(resever.address);
            let clamin = await dcc.claimed(resever.address);
            expect(clamin).to.eq(0);
            let cycleResever = await dcc.getCycle();
            expect(cycleResever).to.eq(0);
            await time.increase(120);
            cycleResever = await dcc.getCycle();
            expect(cycleResever).to.eq(12);
            expect(await dcc.balanceOf(resever.address)).to.eq(0);
            await dcc.claimReserve();
            expect(await dcc.balanceOf(resever.address)).to.eq(
                "110000000000000000000000000"
            );
            clamin = await dcc.claimed(resever.address);
            expect(clamin).to.eq(12);
            await dcc.setReserveAddress(trader2.address);
            clamin = await dcc.claimed(trader2.address);
            expect(clamin).to.eq(12);

            clamin = await dcc.claimed(resever.address);
            expect(clamin).to.eq(0);
        });
        it("Test investor lock", async function () {
            [owner, dev, spender, team, trader2, resever] =
                await ethers.getSigners();
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy(
                "10",
                "48",
                "12",
                "36",
                "12",
                "36",
                "12"
            );
            await expect(
                dcc.connect(trader2).claimInvestor()
            ).to.be.revertedWith("no investor");
            let pid = await dcc.lpOfPid(trader2.address);
            expect(pid).to.eq(0);
            expect(await dcc.balanceOf(trader2.address)).to.eq(0);
            await dcc.addInvestor(trader2.address, "1000");
            await dcc.addInvestor(spender.address, "1000");
            await dcc.connect(trader2).claimInvestor();
            expect(await dcc.balanceOf(trader2.address)).to.eq(0);
            await time.increase(120);
            await dcc.connect(trader2).claimInvestor();
            await dcc.connect(spender).claimInvestor();
            let clamin = await dcc.claimed(trader2.address);
            expect(clamin).to.eq(12);
            expect(await dcc.balanceOf(trader2.address)).to.eq(
                "11000000000000000000000000"
            );
            expect(await dcc.balanceOf(spender.address)).to.eq(
                "11000000000000000000000000"
            );
            await dcc.setInvestor("0", team.address, "1000");
            clamin = await dcc.claimed(team.address);
            expect(clamin).to.eq(12);
            await time.increase(10);

            await expect(
                dcc.connect(trader2).claimInvestor()
            ).to.be.revertedWith("no investor");
            await dcc.connect(spender).claimInvestor();
            await dcc.connect(team).claimInvestor();

            expect(await dcc.balanceOf(trader2.address)).to.eq(
                "11000000000000000000000000"
            );
            expect(await dcc.balanceOf(spender.address)).to.eq(
                "11916666666666666666666666"
            );
            expect(await dcc.balanceOf(team.address)).to.eq(
                "1833333333333333333333333"
            );
        });
        it("after get all token", async function () {
            [owner, dev, spender, team, trader2, resever] =
                await ethers.getSigners();
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy(
                "10",
                "48",
                "12",
                "36",
                "12",
                "36",
                "12"
            );
            await expect(dcc.claimTeam()).to.be.revertedWith("!0");
            await dcc.setTeamAddress(team.address);
            await dcc.setReserveAddress(resever.address);
            await dcc.addInvestor(trader2.address, "5000");
            await dcc.addInvestor(spender.address, "5000");
            await time.increase(490);
            await dcc.claimReserve();
            await dcc.claimTeam();
            await dcc.connect(trader2).claimInvestor();
            await dcc.connect(spender).claimInvestor();

            expect(await dcc.balanceOf(team.address)).to.eq(
                "250000000000000000000000000"
            );
            expect(await dcc.balanceOf(resever.address)).to.eq(
                "330000000000000000000000000"
            );
            expect(await dcc.balanceOf(trader2.address)).to.eq(
                "165000000000000000000000000"
            );
            expect(await dcc.balanceOf(spender.address)).to.eq(
                "165000000000000000000000000"
            );
        });
        it("test execute", async function () {
            [owner, dev, spender, team, trader2, resever] =
                await ethers.getSigners();
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy(
                "10",
                "48",
                "12",
                "36",
                "12",
                "36",
                "12"
            );
            await dcc.transfer(dcc.address, "1000");

            let usdcBef = await dcc.balanceOf(dcc.address);
            let ownerBef = await dcc.balanceOf(owner.address);
            expect(usdcBef).to.be.eq("1000");
            expect(ownerBef).to.be.eq("89999999999999999999999000");
            const provider = new ethers.providers.Web3Provider(
                ethers.provider as any
            ).provider;
            const web3 = new Web3((provider as any)._web3Provider);

            // use abi encode in hardhat test env to call transfer
            let calldata = web3.eth.abi.encodeFunctionCall(
                {
                    name: "transfer",
                    type: "function",
                    inputs: [
                        { type: "address", name: "recipient" },
                        { type: "uint256", name: "amount" },
                    ],
                },
                [owner.address, usdcBef]
            );

            await dcc.execute(dcc.address, 0, calldata);
            let usdcAft = await dcc.balanceOf(dcc.address);
            let ownerAft = await dcc.balanceOf(owner.address);

            expect(usdcAft).to.be.eq(0);
            expect(ownerAft).to.be.eq(ownerBef.add("1000"));
        });
        it("test total alloc point", async function () {
            [owner, dev, spender, team, trader2, resever] =
                await ethers.getSigners();
            const Dcc = await ethers.getContractFactory("DCC");
            const dcc = await Dcc.deploy(
                "10",
                "48",
                "12",
                "36",
                "12",
                "36",
                "12"
            );
            await dcc.addInvestor(dev.address, "1000");
            expect(await dcc.invertorTotalPoint()).to.be.eq("1000");
            await dcc.addInvestor(spender.address, "1000");
            expect(await dcc.invertorTotalPoint()).to.be.eq("2000");
            await expect(
                dcc.addInvestor(team.address, "8001")
            ).to.be.rejectedWith("<=max");
            await expect(
                dcc.setInvestor("0", team.address, "9001")
            ).to.be.rejectedWith("<=max");
            dcc.addInvestor(team.address, "8000");
            expect(await dcc.invertorTotalPoint()).to.be.eq("10000");
            dcc.setInvestor("2", trader2.address, "500");
            expect(await dcc.invertorTotalPoint()).to.be.eq("2500");
            dcc.setInvestor("2", trader2.address, "8000");
            expect(await dcc.invertorTotalPoint()).to.be.eq("10000");
        });
    });
});
