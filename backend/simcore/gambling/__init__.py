"""Gambling domain (v2): a market-share / attraction model of the Danish
gambling market, built on the same engine primitives as the finance domain
(RngHub, the stochastic decision core, the event scheduler, the Recorder).

Purpose (unchanged from the user's brief): simulate **market size, market
share and number of customers** across four product tracks — lotteries,
scratch cards, online casino and sports betting — and understand how
stakeholders / customers / competitors react to shocks (especially wild AI
development and adoption).

This is an illustrative *foresight* tool, not a forecast. The most important
output is which conclusions are robust across the (contested) assumptions,
not any single number. See ``README.md`` and ``params.yaml`` for calibration
and its uncertainty.
"""
