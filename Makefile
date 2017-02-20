test:
	py.test

docker-build:
	docker-compose build

docker-up:
	docker-compose up

docker-stop:
	docker-compose stop

docker-test:
	docker-compose run app make test

.PHONY: test docker-build docker-up docker-stop docker-test
