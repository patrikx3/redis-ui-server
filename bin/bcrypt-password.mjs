#!/usr/bin/env node

import { program } from 'commander'
import bcrypt from 'bcryptjs'

program
    .requiredOption('-p, --password <password>', 'Password to hash')
    .option('-r, --rounds <rounds>', 'BCrypt rounds', '10')
    .parse(process.argv)

const options = program.opts()
const rounds = Number.parseInt(options.rounds, 10)

if (!Number.isInteger(rounds) || rounds < 4 || rounds > 31) {
    console.error('Invalid rounds value. Use an integer between 4 and 31.')
    process.exit(1)
}

const hash = bcrypt.hashSync(options.password, rounds)
console.log(hash)
