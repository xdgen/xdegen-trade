deploy: 
	anchor build && anchor deploy \
	--provider.cluster devnet

run-test:
	anchor test \
	--skip-local-validator \
	--skip-build

run-validator:
	solana-test-validator \
	-ud --clone KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5 \
	--bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s ./tests/metadata.so \
	--bpf-program KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5 ./tests/session-keys.so -r