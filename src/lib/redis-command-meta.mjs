import commandHints from './redis-command-hints.mjs'

/**
 * Category display names and order for autocomplete grouping.
 */
const categoryMap = {
    '@string': 'String',
    '@hash': 'Hash',
    '@list': 'List',
    '@set': 'Set',
    '@sortedset': 'Sorted Set',
    '@stream': 'Stream',
    '@geo': 'Geo',
    '@hyperloglog': 'HyperLogLog',
    '@bitmap': 'Bitmap',
    '@keyspace': 'Key',
    '@connection': 'Connection',
    '@server': 'Server',
    '@generic': 'Generic',
    '@pubsub': 'Pub/Sub',
    '@scripting': 'Scripting',
    '@transactions': 'Transactions',
    '@cluster': 'Cluster',
    '@slow': null, // skip — too generic
    '@fast': null,
    '@read': null,
    '@write': null,
    '@dangerous': null,
    '@admin': null,
}

/**
 * Process raw redis.command() output into metadata for autocomplete.
 * Returns: { [commandName]: { syntax, group } }
 */
export function buildCommandMeta(rawCommands) {
    const meta = {}

    if (Array.isArray(rawCommands)) {
        // Static commands format: array of arrays
        for (const entry of rawCommands) {
            processEntry(entry, meta)
        }
    } else if (rawCommands && typeof rawCommands === 'object') {
        // Live redis.command() format: object keyed by command name
        for (const key of Object.keys(rawCommands)) {
            processEntry(rawCommands[key], meta)
        }
    }

    return meta
}

function processEntry(entry, meta) {
    if (!Array.isArray(entry) || entry.length < 7) return

    const name = entry[0]?.toUpperCase()
    if (!name) return

    const categories = entry[6] || []

    // Find the best display category
    let group = 'Other'
    for (const cat of categories) {
        if (categoryMap.hasOwnProperty(cat) && categoryMap[cat] !== null) {
            group = categoryMap[cat]
            break
        }
    }

    // Static syntax hint or empty
    const syntax = commandHints[name] ?? ''

    meta[name] = { syntax, group }

    // Process subcommands (index 9)
    const subcommands = entry[9]
    if (Array.isArray(subcommands)) {
        for (const sub of subcommands) {
            if (!Array.isArray(sub) || sub.length < 7) continue
            const subName = sub[0]?.toUpperCase()
            if (!subName) continue
            // Subcommand names come as "config|get" — convert to "CONFIG GET"
            const displayName = subName.replace('|', ' ')
            const subSyntax = commandHints[displayName] ?? ''
            meta[displayName] = { syntax: subSyntax, group }
        }
    }
}
