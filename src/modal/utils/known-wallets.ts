export interface KnownWallet {
	name: string;
	rdns: string;
	icon: string;
	downloadUrl: string;
}

const metamaskIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%23F6851B'/%3E%3Cpath d='M29.5 9l-7.2 5.4 1.3-3.2L29.5 9zm-19 0l7.1 5.5-1.2-3.3L10.5 9zm15.4 15.6l-1.9 2.9 4.1 1.1 1.2-4h-3.4zm-14.7 0l-1.2 4 4.1-1.1-1.9-2.9h-1zm14.2-7.4l-1.1 1.7 3.9.2.1-4.2-2.9 2.3zm-10.8 0L11.7 15l-.1 4.3 3.9-.2-1.1-1.7z' fill='white'/%3E%3C/svg%3E";

const trustWalletIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%230500FF'/%3E%3Cpath d='M20 8c3.6 3 7.6 4.2 11 4-0.4 9.4-4.2 16-11 20-6.8-4-10.6-10.6-11-20 3.4.2 7.4-1 11-4z' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E";

const coinbaseIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%230052FF'/%3E%3Ccircle cx='20' cy='20' r='10' fill='white'/%3E%3Crect x='16' y='16' width='8' height='8' rx='1.5' fill='%230052FF'/%3E%3C/svg%3E";

const okxIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='black'/%3E%3Crect x='10' y='10' width='6' height='6' rx='1' fill='white'/%3E%3Crect x='17' y='10' width='6' height='6' rx='1' fill='white'/%3E%3Crect x='24' y='10' width='6' height='6' rx='1' fill='white'/%3E%3Crect x='10' y='17' width='6' height='6' rx='1' fill='white'/%3E%3Crect x='24' y='17' width='6' height='6' rx='1' fill='white'/%3E%3Crect x='10' y='24' width='6' height='6' rx='1' fill='white'/%3E%3Crect x='17' y='24' width='6' height='6' rx='1' fill='white'/%3E%3Crect x='24' y='24' width='6' height='6' rx='1' fill='white'/%3E%3C/svg%3E";

const rabbyIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%237C7AF8'/%3E%3Cellipse cx='20' cy='20' rx='10' ry='9' fill='white'/%3E%3Ccircle cx='16' cy='18' r='2' fill='%237C7AF8'/%3E%3Ccircle cx='24' cy='18' r='2' fill='%237C7AF8'/%3E%3C/svg%3E";

const phantomIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%23AB9FF2'/%3E%3Cellipse cx='20' cy='22' rx='12' ry='8' fill='white'/%3E%3Ccircle cx='15' cy='21' r='2.5' fill='%23AB9FF2'/%3E%3Ccircle cx='25' cy='21' r='2.5' fill='%23AB9FF2'/%3E%3C/svg%3E";

const bitgetIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%2300D4AA'/%3E%3Cpath d='M12 15l8-5 8 5v10l-8 5-8-5V15z' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E";

const gateIcon =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%232354E6'/%3E%3Ccircle cx='20' cy='20' r='9' fill='none' stroke='white' stroke-width='2'/%3E%3Crect x='19' y='14' width='8' height='6' rx='1' fill='white'/%3E%3C/svg%3E";

export const KNOWN_WALLETS: KnownWallet[] = [
	{
		name: "MetaMask",
		rdns: "io.metamask",
		icon: metamaskIcon,
		downloadUrl: "https://metamask.io/download/",
	},
	{
		name: "Trust Wallet",
		rdns: "com.trustwallet.app",
		icon: trustWalletIcon,
		downloadUrl: "https://trustwallet.com/download",
	},
	{
		name: "Coinbase Wallet",
		rdns: "com.coinbase.wallet",
		icon: coinbaseIcon,
		downloadUrl: "https://www.coinbase.com/wallet/downloads",
	},
	{
		name: "OKX Wallet",
		rdns: "com.okex.wallet",
		icon: okxIcon,
		downloadUrl: "https://www.okx.com/web3",
	},
	{
		name: "Rabby",
		rdns: "io.rabby",
		icon: rabbyIcon,
		downloadUrl: "https://rabby.io/",
	},
	{
		name: "Phantom",
		rdns: "app.phantom",
		icon: phantomIcon,
		downloadUrl: "https://phantom.app/download",
	},
	{
		name: "Bitget Wallet",
		rdns: "com.bitget.web3",
		icon: bitgetIcon,
		downloadUrl: "https://web3.bitget.com/",
	},
	{
		name: "Gate Wallet",
		rdns: "com.gate.web3",
		icon: gateIcon,
		downloadUrl: "https://www.gate.io/web3",
	},
];
