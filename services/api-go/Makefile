.PHONY: test test-up test-down fmt tidy vet

test-up:
	docker compose -f test/docker-compose.test.yml up -d --wait

test-down:
	docker compose -f test/docker-compose.test.yml down -v

test: test-up
	TEST_DATABASE_URL=postgres://test:test@localhost:55432/changenow_test?sslmode=disable \
	TEST_REDIS_URL=redis://localhost:56379/0 \
	go test -race ./...

fmt:
	gofmt -w .

tidy:
	go mod tidy

vet:
	go vet ./...
