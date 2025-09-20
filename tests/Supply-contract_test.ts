
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// ============================================================================
// COMMIT 1: Basic Product Registration and Core Functionality Tests
// ============================================================================

Clarinet.test({
    name: "Test successful product registration",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const productId = "PROD-001-2025-ABC123";
        const productName = "Premium Coffee Beans";
        const initialLocation = "Coffee Farm, Colombia";

        let block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii(productName),
                    types.ascii(initialLocation)
                ],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Verify product was registered correctly
        let getProductBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-product",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        
        const productResult = getProductBlock.receipts[0].result;
        assertEquals(productResult.includes(productName), true);
        assertEquals(productResult.includes(initialLocation), true);
        assertEquals(productResult.includes('"registered"'), true);
    },
});

Clarinet.test({
    name: "Test product registration error handling - duplicate product ID",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const productId = "DUPLICATE-PROD-123";

        // First registration should succeed
        let block = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("First Product"),
                    types.ascii("Location A")
                ],
                deployer.address
            )
        ]);
        assertEquals(block.receipts[0].result, "(ok true)");

        // Second registration with same ID should fail
        let duplicateBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Second Product"),
                    types.ascii("Location B")
                ],
                deployer.address
            )
        ]);
        assertEquals(duplicateBlock.receipts[0].result, "(err u103)"); // ERR-PRODUCT-EXISTS
    },
});

Clarinet.test({
    name: "Test initial checkpoint creation upon registration",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const productId = "CHECKPOINT-TEST-001";

        // Register product
        chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "register-product",
                [
                    types.ascii(productId),
                    types.ascii("Test Product"),
                    types.ascii("Test Location")
                ],
                deployer.address
            )
        ]);

        // Check checkpoint was created
        let checkpointBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint",
                [types.ascii(productId), types.uint(1)],
                deployer.address
            )
        ]);
        
        const checkpointResult = checkpointBlock.receipts[0].result;
        assertEquals(checkpointResult.includes('"registered"'), true);
        assertEquals(checkpointResult.includes('Product registered in supply chain'), true);
        
        // Verify checkpoint count
        let countBlock = chain.mineBlock([
            Tx.contractCall(
                "supply-contract",
                "get-checkpoint-count",
                [types.ascii(productId)],
                deployer.address
            )
        ]);
        assertEquals(countBlock.receipts[0].result, "{count: u1}");
    },
});
