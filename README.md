# Rahya

**Rahya** is a backend-focused personal finance application built to
help users understand their money, plan their goals, and make better
financial decisions without taking control away from them.

This repository contains the **Rahya Backend V1**. It provides a REST
API for user registration and sessions, financial accounts,
transactions, and account balances.

> **Project status:** Backend V1 --- active development.\
> **Scope:** Backend API only. No frontend application is included in
> this repository.

## Contents

-   [Overview](#overview)
-   [Implemented capabilities](#implemented-capabilities)
-   [Technology stack](#technology-stack)
-   [Architecture](#architecture)
-   [Financial rules](#financial-rules)
-   [API reference](#api-reference)
-   [Requirements](#requirements)
-   [Configuration](#configuration)
-   [Run locally](#run-locally)
-   [Run tests](#run-tests)
-   [Repository structure](#repository-structure)
-   [Current scope and limitations](#current-scope-and-limitations)

## Overview

Rahya is designed around a simple principle: financial data should
remain understandable and under the user's control.

The backend stores users, accounts, sessions, and financial
transactions. Account balances are derived from the opening balance and
the account's transaction history; the calculated balance is not stored
as an independent source of truth.

The current implementation focuses on the core financial domain and the
integrity of financial history.

## Implemented capabilities

The current repository includes:

-   User registration with name, email, and password.
-   Password hashing using Argon2.
-   Session creation and revocation.
-   Bearer-token authentication backed by persisted sessions.
-   Account creation and account ownership checks.
-   Income, expense, and transfer transactions.
-   Transaction history retrieval for an account.
-   Updating eligible income and expense transactions.
-   Soft deletion of eligible transactions.
-   Current account balance calculation.
-   Historical balance validation before financial mutations.
-   MongoDB transactions and account revision updates to coordinate
    concurrent financial mutations.
-   Liveness and readiness health endpoints.
-   Automated unit, route, and MongoDB integration tests.

The API and implementation are evolving. The endpoint list below
reflects the routes currently registered in `src/app.js`.

## Technology stack

  Area                 Technology
  -------------------- --------------------------------------------
  Runtime              Node.js
  Language             JavaScript (ES modules)
  HTTP API             Express 5
  Database             MongoDB
  ODM                  Mongoose
  Password hashing     Argon2
  Tests                Node.js built-in test runner (`node:test`)
  Development reload   Nodemon

Dependencies and scripts are defined in `package.json`.

## Architecture

The codebase is organized by responsibility:

-   **Routes** register HTTP endpoints and attach middleware.
-   **Controllers** translate HTTP requests into use-case calls and HTTP
    responses.
-   **Use cases** implement application workflows and business rules.
-   **Repositories** isolate persistence operations.
-   **Models** define MongoDB/Mongoose schemas and indexes.
-   **Validation** contains input validation.
-   **Middleware** handles concerns such as JSON request bodies,
    authentication, and centralized error handling.
-   **Config** contains database connection setup.
-   **Auth** contains session-token utilities.

The application entry points are:

-   `src/server.js` --- connects to MongoDB, starts the HTTP server, and
    handles graceful shutdown.
-   `src/app.js` --- configures Express, registers routes, and defines
    health and fallback handlers.

This is a modular backend application. It does not currently introduce a
separate microservice architecture.

## Financial rules

The following rules are enforced by the current V1 implementation.

### Transaction types

Three transaction types are supported:

-   `income`
-   `expense`
-   `transfer`

For income and expense, a transaction belongs to one account. A transfer
has a source account and a different destination account.

### Amounts

Transaction amounts must be finite, greater than zero, and have at most
one decimal place.

### Account ownership

Authenticated account and transaction operations use the authenticated
user's identity. The API does not rely on a client-supplied `userId` to
establish ownership.

### Current balance

An account's current balance is derived from its opening balance and its
non-deleted, non-future transactions:

``` text
Opening Balance
+ Income
- Expense
+ Transfers In
- Transfers Out
= Current Balance
```

The balance is calculated from financial records rather than maintained
as a separately stored balance value.

### Historical balance validation

Before a financial mutation is accepted, the backend validates the
affected account's transaction history. An account must not become
negative at any historical point.

Transactions with the exact same `transactionDate` timestamp are
evaluated as one group: their net effect is applied before the balance
is checked. Transactions at different timestamps are evaluated
chronologically.

For transfers, both the source and destination account histories are
considered.

### Financial mutation consistency

Financial mutations use MongoDB transactions. The affected account
documents are updated through a `financialRevision` mechanism so
concurrent operations can detect write conflicts and re-read/revalidate
history.

### Updates and deletion

Eligible income and expense transactions can be updated. Transfers
cannot be updated or deleted through the current API. Eligible
transactions are soft-deleted; their records are retained and marked
with `deletedAt`.

## API reference

All endpoints return JSON. The application currently registers the
following routes.

  ---------------------------------------------------------------------------------------------
  Method           Endpoint                                     Authentication Purpose
  ---------------- ------------------------------------- --------------------- ----------------
  `POST`           `/users`                                                 No Register a user

  `POST`           `/sessions`                                              No Create a session

  `DELETE`         `/sessions/current`                                     Yes Revoke the
                                                                               current session

  `POST`           `/accounts`                                             Yes Create an
                                                                               account

  `GET`            `/accounts/:accountId/balance`                          Yes Get the current
                                                                               account balance

  `GET`            `/accounts/:accountId/transactions`                     Yes List an
                                                                               account's
                                                                               transactions

  `POST`           `/transactions`                                         Yes Create an
                                                                               income, expense,
                                                                               or transfer

  `PATCH`          `/transactions/:transactionId`                          Yes Update an
                                                                               eligible
                                                                               transaction

  `DELETE`         `/transactions/:transactionId`                          Yes Soft-delete an
                                                                               eligible
                                                                               transaction

  `GET`            `/health/live`                                           No Check whether
                                                                               the HTTP process
                                                                               is alive

  `GET`            `/health/ready`                                          No Check whether
                                                                               MongoDB is
                                                                               connected and
                                                                               the service is
                                                                               ready
  ---------------------------------------------------------------------------------------------

Authenticated endpoints expect:

``` http
Authorization: Bearer <session-token>
```

### Registration and session examples

Register a user:

``` http
POST /users
Content-Type: application/json

{
  "name": "Example User",
  "email": "user@example.com",
  "password": "your-password"
}
```

Create a session:

``` http
POST /sessions
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

Use the session token returned by the session endpoint as a Bearer token
for protected routes. Do not commit real credentials or tokens to the
repository.

### Account and transaction payloads

The exact accepted fields and validation rules are defined in:

-   `src/validation/accountValidation.js`
-   `src/validation/transactionValidation.js`
-   `src/controllers/transactionController.js`

For transaction creation, the main shapes are:

Income or expense:

``` json
{
  "type": "expense",
  "accountId": "<account-id>",
  "amount": 25.5,
  "category": "Food",
  "transactionDate": "2026-10-10T12:00:00+03:30"
}
```

Transfer:

``` json
{
  "type": "transfer",
  "sourceAccountId": "<source-account-id>",
  "destinationAccountId": "<destination-account-id>",
  "amount": 10,
  "transactionDate": "2026-10-10T12:00:00+03:30"
}
```

These are illustrative request shapes. Refer to the validation modules
for the complete accepted input contract.

## Requirements

-   Node.js 20.19 or later, as required by Mongoose 9. The CI workflow
    uses Node.js 24.
-   MongoDB.
-   A MongoDB **replica set** for integration tests and financial
    operations that use multi-document transactions. A standalone
    MongoDB server does not support those transactions.

## Configuration

Install dependencies:

``` bash
npm install
```

Create a local `.env` file in the repository root. The repository
includes `.env.example` as a starting point:

``` env
MONGODB_URI=mongodb://127.0.0.1:27017/rahya?replicaSet=rahya-rs
PORT=3000
```

`PORT` is optional; the server defaults to `3000`.

The MongoDB URI must point to the `rahya` application database and
include the correct replica-set configuration for your local MongoDB
setup.

### Test database

Integration tests require a separate `MONGODB_TEST_URI`. They explicitly
verify that the database name is `rahya_test`.

Add this variable to your local `.env` file:

``` env
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/rahya_test?replicaSet=rahya-rs
```

Use a dedicated test database. Do not point `MONGODB_TEST_URI` at the
application database.

The `.env` file is ignored by Git and must never be committed.

## Run locally

Start the server:

``` bash
npm start
```

The `start` script loads `.env` and starts `src/server.js`.

For development with automatic restart:

``` bash
npm run dev
```

The server connects to MongoDB before listening for HTTP requests. By
default it listens on port `3000`.

Health checks:

``` text
GET http://localhost:3000/health/live
GET http://localhost:3000/health/ready
```

`/health/live` checks the HTTP process. `/health/ready` returns a
successful response only when the Mongoose connection is ready.

## Run tests

The project uses Node.js's built-in test runner.

Run the full test suite with the environment variables loaded from
`.env`:

``` bash
node --env-file=.env --test
```

The integration tests require `MONGODB_TEST_URI` to be set and a
replica-set MongoDB instance to be available. They are designed to use
`rahya_test`, not `rahya`.

The package script `npm test` currently runs `node --test` directly. It
does not itself load `.env`; use the command above when your test
configuration is stored in `.env`.

## Repository structure

``` text
Rahya/
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── src/
│   ├── app.js
│   ├── server.js
│   ├── auth/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── repositories/
│   ├── routes/
│   ├── useCases/
│   └── validation/
└── test/
    ├── unit and route tests
    └── MongoDB integration tests
```

## Current scope and limitations

-   This repository contains the backend API; no frontend is included.
-   The API is under active development and its contracts may evolve.
-   The current account currency default is `Toman`.
-   The current transaction date format is `YYYY-MM-DDTHH:mm:ss+03:30`.
-   HTTP-level idempotency keys are not currently implemented. Clients
    should not assume that retrying a transaction-creation request is
    automatically deduplicated.
-   Deployment, production infrastructure, monitoring, and operational
    hardening are outside the scope of this repository's current
    documented V1.

## Development

Issues, focused changes, and clear commit history are preferred. Keep
business rules explicit, preserve financial data integrity, and add
tests for changes to financial workflows.
