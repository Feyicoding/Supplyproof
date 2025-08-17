
;; SupplyProof Contract
;; Supply chain tracking contract that records each product checkpoint, 
;; ensuring authenticity and traceability.

;; constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u101))
(define-constant ERR-PRODUCT-NOT-FOUND (err u102))
(define-constant ERR-PRODUCT-EXISTS (err u103))
(define-constant ERR-INVALID-OWNER (err u104))
(define-constant ERR-INVALID-STATUS (err u105))

;; data maps and vars
;; Map to store product information
(define-map products
  { product-id: (string-ascii 36) }
  {
    name: (string-ascii 100),
    manufacturer: principal,
    current-owner: principal,
    status: (string-ascii 50),
    location: (string-ascii 100),
    timestamp: uint,
    is-active: bool
  }
)

;; Map to store product checkpoint history
(define-map product-checkpoints
  { product-id: (string-ascii 36), checkpoint-index: uint }
  {
    handler: principal,
    previous-owner: principal,
    new-owner: principal,
    status: (string-ascii 50),
    location: (string-ascii 100),
    timestamp: uint,
    notes: (string-ascii 500)
  }
)

;; Map to track checkpoint counts for each product
(define-map checkpoint-counters
  { product-id: (string-ascii 36) }
  { count: uint }
)

;; Variable to track total number of products registered
(define-data-var total-products uint u0)

;; private functions
;; Helper function to generate the next checkpoint index for a product
(define-private (get-next-checkpoint-index (product-id (string-ascii 36)))
  (let ((current-count (default-to { count: u0 } (map-get? checkpoint-counters { product-id: product-id }))))
    (+ (get count current-count) u1)
  )
)

;; Helper function to increment checkpoint counter
(define-private (increment-checkpoint-counter (product-id (string-ascii 36)))
  (let ((current-count (default-to { count: u0 } (map-get? checkpoint-counters { product-id: product-id }))))
    (map-set checkpoint-counters
      { product-id: product-id }
      { count: (+ (get count current-count) u1) }
    )
  )
)

;; public functions
;; Function to register a new product in the supply chain
(define-public (register-product
  (product-id (string-ascii 36))
  (name (string-ascii 100))
  (initial-location (string-ascii 100))
)
  (let ((existing-product (map-get? products { product-id: product-id })))
    (if (is-some existing-product)
      ERR-PRODUCT-EXISTS
      (begin
        ;; Create the product record
        (map-set products
          { product-id: product-id }
          {
            name: name,
            manufacturer: tx-sender,
            current-owner: tx-sender,
            status: "registered",
            location: initial-location,
            timestamp: block-height,
            is-active: true
          }
        )
        ;; Initialize checkpoint counter
        (map-set checkpoint-counters
          { product-id: product-id }
          { count: u1 }
        )
        ;; Record the initial checkpoint
        (map-set product-checkpoints
          { product-id: product-id, checkpoint-index: u1 }
          {
            handler: tx-sender,
            previous-owner: tx-sender,
            new-owner: tx-sender,
            status: "registered",
            location: initial-location,
            timestamp: block-height,
            notes: "Product registered in supply chain"
          }
        )
        ;; Increment total products counter
        (var-set total-products (+ (var-get total-products) u1))
        (ok true)
      )
    )
  )
)

;; Function to update product status (by current owner only)
(define-public (update-product-status
  (product-id (string-ascii 36))
  (new-status (string-ascii 50))
  (new-location (string-ascii 100))
  (notes (string-ascii 500))
)
  (let ((product (map-get? products { product-id: product-id })))
    (match product
      existing-product
      (if (is-eq tx-sender (get current-owner existing-product))
        (let ((checkpoint-index (get-next-checkpoint-index product-id)))
          ;; Update product information
          (map-set products
            { product-id: product-id }
            (merge existing-product {
              status: new-status,
              location: new-location,
              timestamp: block-height
            })
          )
          ;; Record checkpoint
          (map-set product-checkpoints
            { product-id: product-id, checkpoint-index: checkpoint-index }
            {
              handler: tx-sender,
              previous-owner: (get current-owner existing-product),
              new-owner: (get current-owner existing-product),
              status: new-status,
              location: new-location,
              timestamp: block-height,
              notes: notes
            }
          )
          ;; Increment checkpoint counter
          (increment-checkpoint-counter product-id)
          (ok true)
        )
        ERR-NOT-AUTHORIZED
      )
      ERR-PRODUCT-NOT-FOUND
    )
  )
)

;; Function to transfer product ownership
(define-public (transfer-ownership
  (product-id (string-ascii 36))
  (new-owner principal)
  (new-location (string-ascii 100))
  (notes (string-ascii 500))
)
  (let ((product (map-get? products { product-id: product-id })))
    (match product
      existing-product
      (if (is-eq tx-sender (get current-owner existing-product))
        (let ((checkpoint-index (get-next-checkpoint-index product-id)))
          ;; Update product ownership and location
          (map-set products
            { product-id: product-id }
            (merge existing-product {
              current-owner: new-owner,
              location: new-location,
              timestamp: block-height,
              status: "transferred"
            })
          )
          ;; Record ownership transfer checkpoint
          (map-set product-checkpoints
            { product-id: product-id, checkpoint-index: checkpoint-index }
            {
              handler: tx-sender,
              previous-owner: (get current-owner existing-product),
              new-owner: new-owner,
              status: "transferred",
              location: new-location,
              timestamp: block-height,
              notes: notes
            }
          )
          ;; Increment checkpoint counter
          (increment-checkpoint-counter product-id)
          (ok true)
        )
        ERR-NOT-AUTHORIZED
      )
      ERR-PRODUCT-NOT-FOUND
    )
  )
)

;; Function to record a checkpoint without ownership change
(define-public (record-checkpoint
  (product-id (string-ascii 36))
  (status (string-ascii 50))
  (location (string-ascii 100))
  (notes (string-ascii 500))
)
  (let ((product (map-get? products { product-id: product-id })))
    (match product
      existing-product
      (if (is-eq tx-sender (get current-owner existing-product))
        (let ((checkpoint-index (get-next-checkpoint-index product-id)))
          ;; Update product status and location
          (map-set products
            { product-id: product-id }
            (merge existing-product {
              status: status,
              location: location,
              timestamp: block-height
            })
          )
          ;; Record checkpoint
          (map-set product-checkpoints
            { product-id: product-id, checkpoint-index: checkpoint-index }
            {
              handler: tx-sender,
              previous-owner: (get current-owner existing-product),
              new-owner: (get current-owner existing-product),
              status: status,
              location: location,
              timestamp: block-height,
              notes: notes
            }
          )
          ;; Increment checkpoint counter
          (increment-checkpoint-counter product-id)
          (ok true)
        )
        ERR-NOT-AUTHORIZED
      )
      ERR-PRODUCT-NOT-FOUND
    )
  )
)

;; Function to deactivate a product (emergency function)
(define-public (deactivate-product
  (product-id (string-ascii 36))
  (reason (string-ascii 500))
)
  (let ((product (map-get? products { product-id: product-id })))
    (match product
      existing-product
      (if (or (is-eq tx-sender (get manufacturer existing-product))
              (is-eq tx-sender (get current-owner existing-product)))
        (let ((checkpoint-index (get-next-checkpoint-index product-id)))
          ;; Deactivate product
          (map-set products
            { product-id: product-id }
            (merge existing-product {
              is-active: false,
              status: "deactivated",
              timestamp: block-height
            })
          )
          ;; Record deactivation checkpoint
          (map-set product-checkpoints
            { product-id: product-id, checkpoint-index: checkpoint-index }
            {
              handler: tx-sender,
              previous-owner: (get current-owner existing-product),
              new-owner: (get current-owner existing-product),
              status: "deactivated",
              location: (get location existing-product),
              timestamp: block-height,
              notes: reason
            }
          )
          ;; Increment checkpoint counter
          (increment-checkpoint-counter product-id)
          (ok true)
        )
        ERR-NOT-AUTHORIZED
      )
      ERR-PRODUCT-NOT-FOUND
    )
  )
)
