/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
"use strict"

// Patch `Linter#verify` to work.
require("../patch").patch()

module.exports = {
    meta: {
        docs: {
            description: "disallows unused `eslint-disable` comments",
            category: "Best Practices",
            recommended: false,
            url:
                "https://github.com/mysticatea/eslint-plugin-eslint-comments/blob/v3.0.0-beta.2/docs/rules/no-unused-disable.md",
        },
        fixable: null,
        schema: [],
    },

    create() {
        // This rule patches `Linter#verify` method and:
        //
        // 1. enables `reportUnusedDisableDirectives` option.
        // 2. verifies the code.
        // 3. converts `reportUnusedDisableDirectives` errors to `no-unused-disable` errors.
        //
        // So this rule itself does nothing.
        return {}
    },
}
