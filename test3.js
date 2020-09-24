const solana = require("@solana/web3.js");
var fs = require("fs");
const BufferLayout = require("buffer-layout");
const bs58 = require("bs58");

const DEV_NET = "https://devnet.solana.com";
const TEST_NET = "https://testnet.solana.com";

// Get Connection to Cluster, Currently on DEVNET
async function getConnection() {
  const url = DEV_NET;
  const connection = new solana.Connection(url, "recent");
  const version = await connection.getVersion();
  console.log("Connection to Cluster established: ", url, version);
  return connection;
}

// Load Wallet, Change to your Dir and Wallet if needs
async function getAccount(keypair) {
  const walletFolder = "wallet/";
  const secret = JSON.parse(fs.readFileSync(walletFolder + keypair));
  const account = new solana.Account(secret);
  console.log("Account: " + account.publicKey.toBase58());
  return account;
}

// Load Program and Account Information, Check Whether it is on-chain
async function getStore(connection) {
  let config;
  try {
    const data = fs.readFileSync("store/simplest.json", "utf8");
    config = JSON.parse(data);
    console.log(config);
  } catch (err) {
    console.log(err);
  }

  let programId;
  try {
    programId = new solana.PublicKey(config.programId);
    console.log("Program ID: " + programId.toString());
  } catch (err) {
    console.log("No programId in file");
  }

  let programInfo = await connection.getAccountInfo(programId);

  if (!programInfo) {
    console.log("No programId on-chain");
  } else {
    console.log("Program Info Received. ");
  }

  let accountId;
  try {
    accountId = new solana.PublicKey(config.accountId);
    console.log("Account ID: " + accountId.toString());
  } catch (err) {
    console.log("No accountId in file");
  }

  let accountInfo = await connection.getAccountInfo(accountId);
  if (!accountInfo) {
    console.log("No accountId on-chain");
  } else {
    console.log("Account Info Received. ");
  }
  return { programId, accountId };
}

// Display Vote Count Storing in On-Chain Rust Program
async function getProgAccInfo(connection, store) {
  console.log("-----");
  const accountInfo = await connection.getAccountInfo(store.accountId);
  const data = Buffer.from(accountInfo.data);

  const accountDataLayout = BufferLayout.struct([
    BufferLayout.u32("count1"),
    BufferLayout.u32("count2"),
  ]);

  const counts = accountDataLayout.decode(data);

  console.log(
    "Vote counts: candidate1:",
    counts.count1,
    "candidate2:",
    counts.count2
  );
  console.log("-----");
}

// Create Collection Account
// async createCollection

async function main() {
  // Cluster Connection, Currently on DEVNET
  const connection = await getConnection();

  // Load Wallet (Change the keypair.json file and folder dir in testing)
  const acc = await getAccount("kenny-wallet.json");

  // Load Program and Account Info
  const s = await getStore(connection);

  // Voting Candidate Data ("1" or "2")
  let candidate = parseInt("1", 10);
  console.log(`Data: ${candidate}`);

  // Check Base58 Data === Solana Explorer Instruction Data
  console.log(`Base 58 Encoded: ${bs58.encode(Buffer.from([candidate]))}`);

  // Instruction to Rust Program on-chain
  const instruction = new solana.TransactionInstruction({
    keys: [{ pubkey: s.accountId, isSigner: false, isWritable: true }],
    programId: s.programId,
    data: Buffer.from([candidate]),
  });

  // Instruction of SOL Transaction. Change lamports to Customize SOL Amount
  const sol_transaction = solana.SystemProgram.transfer({
    fromPubkey: acc.publicKey,
    toPubkey: s.accountId,
    lamports: 0.1 * solana.LAMPORTS_PER_SOL,
  });

  // Add Instruction to Transaction
  const full_transaction = new solana.Transaction();
  await full_transaction.add(instruction);
  await full_transaction.add(sol_transaction);

  // Perform Transaction
  let signature;
  try {
    signature = await solana.sendAndConfirmTransaction(
      connection,
      full_transaction,
      [acc]
      //{ commitment: 3, skipPreflight: true }
    );
    // Check Transaction on Solana Explorer
    console.log(`Transaction ${signature} has been confirmed`);
  } catch (e) {
    console.log(e);
  }

  // Check Account Data (Voting) After Transaction
  await getProgAccInfo(connection, s);

  // Check Wallet Balance After Transaction
  const balance = await connection.getBalance(acc.publicKey);
  console.log(`Balance : ${balance / solana.LAMPORTS_PER_SOL} SOL`);

  /* const second_transaction = new solana.Transaction();
  const sol_transaction_back = solana.SystemProgram.transfer({
    fromPubkey: s.accountId,
    toPubkey: acc.publicKey,
    lamports: 0.2 * solana.LAMPORTS_PER_SOL,
  });
  let signature;
  try {
    signature = await solana.sendAndConfirmTransaction(
      connection,
      second_transaction,
      [acc]
      //{ commitment: 3, skipPreflight: true }
    );
    // Check Transaction on Solana Explorer
    console.log(`Transaction ${signature} has been confirmed`);
  } catch (e) {
    console.log(e);
  } */
}

main();
