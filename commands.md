
# Starts a blockchain server

yarn hardhat node

# Connect to network

yarn hardhat console --network localhost // execute any command

yarn hardhat run scripts/deploy.js --network localhost // execute scripts on local network

# Compile:

yarn hardhat compile

# Deploy:

yarn hardhat run scripts/deploy.js --network sepolia (default: hardhat local network)

Verify (cmd line):

yarn hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS


# Run tests:

yarn hardhat test (check gas-report.txt)

yarn hardhat coverage

run specific test cases:

yarn hardhat test --grap "should store value when"


# best practice:
 remove artifacts and cash and re compile your contract
