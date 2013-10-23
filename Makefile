#! /usr/bin/make

.phony: test
test: PATTERN=tests/*.html
test:
	@grover $(PATTERN)
