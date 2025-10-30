run-delegation-validator:  
	mb-test-validator --reset --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s ./tests/metadata.so

deploy: 
	anchor build && anchor deploy \
	--provider.cluster devnet

run-ervalidator:
	RUST_LOG=info ephemeral-validator \
		--accounts-lifecycle ephemeral \
		--remote-url https://rpc.magicblock.app/devnet \
		--rpc-port 7799

# run-test:
# 	EPHEMERAL_PROVIDER_ENDPOINT="http://localhost:7799" \
# 	EPHEMERAL_WS_ENDPOINT="ws://localhost:7800" \
# 	anchor test \
# 	--provider.cluster localnet \
# 	--skip-local-validator \
# 	--skip-build \
# 	--skip-deploy

run-test:
	anchor test \
	--provider.cluster devnet \
	--skip-local-validator \
	--skip-build \
	--skip-deploy
