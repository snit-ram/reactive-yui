#! /usr/bin/make

.phony: test
test: PATTERN=tests/*.html
test:
	@grover $(PATTERN)


.phony: coverage
coverage: PATTERN=tests/*.html
coverage:
	@rm -rf cov
	@mkdir -p cov
	@istanbul instrument src -o cov/src
	@cp -r tests cov/
	@cp -r vendor cov/
	@grover --coverage -p cov/ --coverdir cov/results $(PATTERN)
