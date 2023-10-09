module.exports = {
    overrides: [
        {
            files: ["*.ts", "*.tsx"],
            rules: {
                "no-restricted-imports": [
                    "error",
                    {
                        paths: [
                            { name: "@/index", message: "Import from the source file instead." },
                        ],
                    },
                ],
            },
        },
    ],
};
