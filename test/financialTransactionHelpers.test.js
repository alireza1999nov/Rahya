import assert from 'node:assert/strict';
import test from 'node:test';

import { runFinancialTransaction } from '../src/useCases/financialTransactionHelpers.js';

test('does not replay a financial operation after an unknown commit result', async () => {
    let callbackRuns = 0;
    const unknownCommitError = new Error('Commit result is unknown');
    unknownCommitError.hasErrorLabel = (label) =>
        label === 'UnknownTransactionCommitResult';

    const transactionRepository = {
        async withTransaction(operation) {
            await operation({});
            throw unknownCommitError;
        },
    };

    await assert.rejects(
        runFinancialTransaction(transactionRepository, async () => {
            callbackRuns++;
        }),
        { name: 'FinancialOutcomeUnknownError' },
    );

    assert.equal(callbackRuns, 1);
});
