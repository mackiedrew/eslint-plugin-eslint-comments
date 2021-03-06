/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
"use strict"

const path = require("path")
const { toRuleIdLocation } = require("./utils")
const needle = `${path.sep}eslint${path.sep}`
const quotedName = /'(.+?)'/

/**
 * Get the severity of a given rule.
 * @param {object} config The config object to check.
 * @param {string} ruleId The rule ID to check.
 * @returns {number} The severity of the rule.
 */
function getSeverity(config, ruleId) {
    const rules = config && config.rules
    const ruleOptions = rules && rules[ruleId]
    const severity = Array.isArray(ruleOptions) ? ruleOptions[0] : ruleOptions

    switch (severity) {
        case 2:
        case "error":
            return 2

        case 1:
        case "warn":
            return 1

        default:
            return 0
    }
}

/**
 * Get the comment which is at a given message location.
 * @param {Message} message The message to get.
 * @param {SourceCode|undefined} sourceCode The source code object to get.
 * @returns {Comment|undefined} The gotten comment.
 */
function getCommentAt(message, sourceCode) {
    if (sourceCode != null) {
        const loc = { line: message.line, column: message.column - 1 }
        const index = sourceCode.getIndexFromLoc(loc)
        const options = { includeComments: true }
        const comment = sourceCode.getTokenByRangeStart(index, options)
        if (
            comment != null &&
            (comment.type === "Line" || comment.type === "Block")
        ) {
            return comment
        }
    }
    return undefined
}

/**
 * Check whether a given message is a `reportUnusedDisableDirectives` error.
 * @param {Message} message The message.
 * @returns {boolean} `true` if the message is a `reportUnusedDisableDirectives` error.
 */
function isUnusedDisableDirectiveError(message) {
    return (
        !message.fatal &&
        !message.ruleId &&
        message.message.includes("eslint-disable")
    )
}

/**
 * Create `eslint-comments/no-unused-disable` error.
 * @param {string} ruleId The ruleId.
 * @param {number} severity The severity of the rule.
 * @param {Message} message The original message.
 * @param {Comment|undefined} comment The directive comment.
 * @returns {Message} The created error.
 */
function createNoUnusedDisableError(ruleId, severity, message, comment) {
    const clone = Object.assign({}, message)
    const match = quotedName.exec(message.message)
    const targetRuleId = match && match[1]

    clone.ruleId = ruleId
    clone.severity = severity
    clone.message = targetRuleId
        ? `'${targetRuleId}' rule is disabled but never reported.`
        : "ESLint rules are disabled but never reported."

    if (comment != null) {
        if (targetRuleId) {
            const loc = toRuleIdLocation(comment, targetRuleId)
            clone.line = loc.start.line
            clone.column = loc.start.column + 1
            clone.endLine = loc.end.line
            clone.endColumn = loc.end.column + 1
        } else {
            clone.endLine = comment.loc.end.line
            clone.endColumn = comment.loc.end.column + 1
        }
    }

    return clone
}

/**
 * Convert `reportUnusedDisableDirectives` errors to `eslint-comments/no-unused-disable` errors.
 * @param {Message[]} messages The original messages.
 * @param {SourceCode|undefined} sourceCode The source code object.
 * @param {string} ruleId The rule ID to convert.
 * @param {number} severity The severity of the rule.
 * @param {boolean} keepAsIs The flag to keep original errors as is.
 * @returns {Message[]} The converted messages.
 */
function convert(messages, sourceCode, ruleId, severity, keepAsIs) {
    for (let i = messages.length - 1; i >= 0; --i) {
        const message = messages[i]
        if (!isUnusedDisableDirectiveError(message)) {
            continue
        }

        const newMessage = createNoUnusedDisableError(
            ruleId,
            severity,
            message,
            getCommentAt(message, sourceCode)
        )

        if (keepAsIs) {
            messages.splice(i + 1, 0, newMessage)
        } else {
            messages.splice(i, 1, newMessage)
        }
    }

    return messages
}

module.exports.patch = (ruleId = "eslint-comments/no-unused-disable") => {
    for (const eslintPath of new Set(
        Object.keys(require.cache)
            .filter(id => id.includes(needle))
            .map(id => id.slice(0, id.indexOf(needle) + needle.length))
    )) {
        const Linter = require(eslintPath).Linter
        const verify0 = Linter.prototype.verify

        Object.defineProperty(Linter.prototype, "verify", {
            value: function verify(
                textOrSourceCode,
                config,
                filenameOrOptions
            ) {
                const severity = getSeverity(config, ruleId)
                if (severity === 0) {
                    return verify0.call(
                        this,
                        textOrSourceCode,
                        config,
                        filenameOrOptions
                    )
                }

                const options =
                    typeof filenameOrOptions === "string"
                        ? { filename: filenameOrOptions }
                        : filenameOrOptions || {}
                const reportUnusedDisableDirectives = Boolean(
                    options.reportUnusedDisableDirectives
                )
                const messages = verify0.call(
                    this,
                    textOrSourceCode,
                    config,
                    Object.assign({}, options, {
                        reportUnusedDisableDirectives: true,
                    })
                )
                return convert(
                    messages,
                    this.getSourceCode(),
                    ruleId,
                    severity,
                    reportUnusedDisableDirectives
                )
            },
            configurable: true,
            writable: true,
        })
    }
}
