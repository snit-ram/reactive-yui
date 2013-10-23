#! /usr/bin/make

.phony: test
test: PATTERN=tests/*.html
test:
	@grover $(PATTERN)


.phony: coverage
coverage: PATTERN=tests/*.html
coverage:
	@mkdir -p cov
	@cp -r tests cov/
	@cp -r vendor cov/
	@grover --coverage -p cov/ --coverdir cov/results $(PATTERN)
