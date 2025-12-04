// Configuration
// Use relative path for API - works in both localhost and production
const API_BASE = window.location.origin + '/api';
// IMPORTANT: Replace with your Stripe PUBLISHABLE key (starts with pk_live_ or pk_test_)
// Get it from: https://dashboard.stripe.com/apikeys
// The secret key is configured on the server side
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SVFspEW8cQp4AXRTjATqHrKgnARWpwsk8U4kG8AbQZqvpFtRlzvcqzY8n5atepd54Vw61fBAvuNl7wNCZ4l7Oox00MjKUbFUn';

let shopId = null;
let printifyProducts = [];
let cart = [];
let currentProduct = null;
let stripe = null;
let shippingCost = 0; // Shipping cost in cents
let shippingAddress = null;
let shippingEstimate = null; // Delivery estimate from Printful
let selectedShippingRate = null;

// Initialize Stripe
// NOTE: The key you provided starts with 'rk_live_' which is a restricted key.
// You need a publishable key that starts with 'pk_live_' or 'pk_test_'
// Get it from: https://dashboard.stripe.com/apikeys
if (STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY !== 'YOUR_STRIPE_PUBLISHABLE_KEY_HERE' && STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    console.log('Stripe initialized');
} else {
    console.warn('Stripe publishable key not configured correctly. Please add your publishable key (pk_...) in script.js');
    console.warn('Get your publishable key from: https://dashboard.stripe.com/apikeys');
}

// Navigation scroll effect
document.addEventListener('DOMContentLoaded', function() {
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Initialize app
    initApp();
});

// Initialize application
async function initApp() {
    try {
        console.log('Initializing app...');
        
        // Get shop ID first
        const shopsResponse = await fetch(`${API_BASE}/shops`);
        const shopsData = await shopsResponse.json();
        
        console.log('Shops response:', shopsData);
        
        // Printiful uses 'result' instead of 'data'
        if (shopsData.error || (shopsData.code && shopsData.code !== 200)) {
            showError(`Printiful API Error: ${shopsData.error || 'Unknown error'}. Please check your API token.`);
            renderErrorState('AUTHENTICATION ERROR');
            return;
        }
        
        // Printiful response format: { code: 200, result: [...] }
        const stores = shopsData.result || shopsData.data || [];
        
        if (stores.length > 0) {
            shopId = stores[0].id;
            console.log('Store ID:', shopId);
            
            // Load products
            await loadProducts();
        } else {
            showError('No stores found. Please check your Printiful account.');
            renderErrorState('NO STORES FOUND');
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to load products. Make sure the server is running on http://localhost:3000');
        renderErrorState('CONNECTION ERROR');
    }
}

// Load products from Printify
async function loadProducts() {
    try {
        console.log('Loading products for shop:', shopId);
        const response = await fetch(`${API_BASE}/shops/${shopId}/products`);
        const data = await response.json();
        
        console.log('Products response:', data);
        
        // Printiful uses 'result' instead of 'data'
        if (data.error || (data.code && data.code !== 200)) {
            showError(`Error: ${data.error || 'Unknown error'}`);
            renderErrorState('PRODUCTS ERROR');
            return;
        }
        
        // Printiful response format: { code: 200, result: [...] }
        const products = data.result || data.data || [];
        
        console.log('Total products received:', products.length);
        
        if (products.length > 0) {
            // Filter to only show: 2 skydome shirts and 1 galleria mall shirt
            const filteredProducts = products.filter(p => {
                const name = (p.name || '').toLowerCase();
                return name.includes('skydome') || name.includes('galleria');
            });
            
            // Separate skydome and galleria (exclude "SkyDome Cap")
            const skydomeProducts = filteredProducts.filter(p => {
                const name = (p.name || '').toLowerCase();
                return name.includes('skydome') && !name.includes('cap');
            }).slice(0, 2); // Only 2 skydome shirts
            
            const galleriaProducts = filteredProducts.filter(p => 
                (p.name || '').toLowerCase().includes('galleria')
            ).slice(0, 1); // Only 1 galleria
            
            printifyProducts = [...skydomeProducts, ...galleriaProducts];
            
            console.log('Filtered products to display:', printifyProducts.length);
            console.log('Products:', printifyProducts.map(p => p.name));
            
            if (printifyProducts.length > 0) {
                renderProducts();
            } else {
                showError('No products found to display.');
                renderErrorState('NO PRODUCTS');
            }
        } else {
            showError('No products found in your Printiful store. Add products in your Printiful dashboard.');
            renderErrorState('NO PRODUCTS');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products from Printify.');
        renderErrorState('LOAD ERROR');
    }
}

// Render error state
function renderErrorState(message) {
    const productsGrid = document.getElementById('productsGrid');
    productsGrid.innerHTML = `
        <div class="loading-state" style="color: #ff4444;">
            ${message}<br>
            <span style="font-size: 12px; margin-top: 20px; display: block; color: #999;">
                Check console for details
            </span>
        </div>
    `;
}

// Render products to the grid
function renderProducts() {
    const productsGrid = document.getElementById('productsGrid');
    
    if (!productsGrid) {
        console.error('Products grid element not found!');
        return;
    }
    
    if (printifyProducts.length === 0) {
        productsGrid.innerHTML = '<div class="loading-state">NO PRODUCTS FOUND</div>';
        return;
    }
    
    console.log('Rendering', printifyProducts.length, 'products');
    
    try {
        productsGrid.innerHTML = printifyProducts.map((product, index) => {
        // Get the product image
        const productImage = getProductMockup(product);
        // Printiful store products use 'name' field
        const productName = product.name || product.title || `PRODUCT ${index + 1}`;
        const price = formatPrice(product);
            // Use the actual product ID from Printful
            const productId = product.id;
            
            console.log(`Product ${index + 1}:`, productName, 'ID:', productId, 'Image:', productImage ? 'Yes' : 'No');
            
            return `
                <div class="product-item" data-product-id="${productId}" data-product-index="${index}">
                    <div class="product-image">
                        ${productImage ? 
                            `<img src="${productImage}" alt="${productName}" class="product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                            ''
                        }
                        <div class="product-placeholder" style="${productImage ? 'display:none;' : ''}">${String(index + 1).padStart(2, '0')}</div>
                        <div class="product-overlay">
                            <button class="product-quick-view">QUICK VIEW</button>
                        </div>
                    </div>
                    <div class="product-info">
                        <h3 class="product-name">${productName.toUpperCase()}</h3>
                        <p class="product-price">${price}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('Products rendered successfully');
        
        // Re-attach event listeners
        attachProductListeners();
        
        // Re-observe for animations
        setTimeout(() => {
            document.querySelectorAll('.product-item').forEach(item => {
                observer.observe(item);
            });
        }, 100);
    } catch (error) {
        console.error('Error rendering products:', error);
        productsGrid.innerHTML = '<div class="loading-state" style="color: #ff4444;">ERROR RENDERING PRODUCTS</div>';
    }
}

// Get product mockup image (Printiful store product format)
function getProductMockup(product) {
    // Printiful store products have thumbnail_url directly
    if (product.thumbnail_url) {
        return product.thumbnail_url;
    }
    
    // Check variants for images
    if (product.variants && product.variants.length > 0) {
        const firstVariant = product.variants[0];
        if (firstVariant.files && firstVariant.files.length > 0) {
            const previewFile = firstVariant.files.find(f => f.type === 'preview') || firstVariant.files[0];
            if (previewFile && previewFile.preview_url) {
                return previewFile.preview_url;
            }
            if (previewFile && previewFile.url) {
                return previewFile.url;
            }
        }
    }
    
    // Fallback
    if (product.image) {
        return product.image;
    }
    
    return null;
}

// Format price from Printiful store product
function formatPrice(product) {
    // Printiful store products have variants with retail_price
    if (product.variants && product.variants.length > 0) {
        const prices = product.variants
            .map(v => parseFloat(v.retail_price || v.price || 0))
            .filter(p => p > 0);
            
        if (prices.length > 0) {
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            if (minPrice === maxPrice) {
                return `$${minPrice.toFixed(2)}`;
            }
            return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
        }
    }
    
    // Default price for display
    return 'From $27';
}

// Attach event listeners to products
function attachProductListeners() {
    const productItems = document.querySelectorAll('.product-item');
    const quickViewButtons = document.querySelectorAll('.product-quick-view');
    
    productItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (!e.target.classList.contains('product-quick-view')) {
                const productId = this.dataset.productId;
                openModal(productId);
            }
        });
    });
    
    quickViewButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const productItem = this.closest('.product-item');
            const productId = productItem.dataset.productId;
            openModal(productId);
        });
    });
}

// Open product modal
async function openModal(productId) {
    try {
        // Try to find by ID first, then by index if ID doesn't match
        let product = printifyProducts.find(p => {
            const pId = p.id;
            return pId == productId || String(pId) === String(productId);
        });
        
        // If not found by ID, try by index
        if (!product) {
            const productIndex = parseInt(productId);
            if (!isNaN(productIndex) && productIndex >= 0 && productIndex < printifyProducts.length) {
                product = printifyProducts[productIndex];
            }
        }
        
        if (!product) {
            console.error('Product not found. ProductId:', productId, 'Type:', typeof productId);
            console.error('Available products:', printifyProducts.map((p, i) => ({ id: p.id, index: i, name: p.name })));
            showError('Product not found');
            return;
        }
        
        // Fetch full product details to get sync_variants array
        console.log('Fetching full product details for:', product.id);
        try {
            const response = await fetch(`${API_BASE}/shops/${shopId}/products/${product.id}`);
            const productData = await response.json();
            
            if (productData.result && productData.code === 200) {
                // Full product has sync_product and sync_variants
                // Merge sync_product data and add sync_variants as variants
                product = { 
                    ...product, 
                    ...productData.result.sync_product,
                    variants: productData.result.sync_variants || []
                };
                console.log('Full product data loaded with', product.variants?.length || 0, 'variants');
        } else {
                console.warn('Could not fetch full product details, using summary');
                // Set empty variants array if we can't fetch
                product.variants = [];
            }
        } catch (error) {
            console.error('Error fetching full product details:', error);
            // Set empty variants array on error
            product.variants = [];
        }
        
        currentProduct = product;
        
        // Update modal content (Printiful store products use 'name' field)
        const productTitle = product.name || product.title || 'PRODUCT';
        document.getElementById('modalTitle').textContent = productTitle.toUpperCase();
        
        // Set initial price - will be updated when size is selected
        const initialPrice = product.variants && product.variants.length > 0 
            ? parseFloat(product.variants[0].retail_price || 0)
            : 0;
        document.getElementById('modalPrice').textContent = initialPrice > 0 
            ? `$${initialPrice.toFixed(2)}` 
            : formatPrice(product);
        
        // Update modal image
        const modalImage = document.getElementById('modalImage');
        const mockupImage = getProductMockup(product);
        if (mockupImage) {
            modalImage.innerHTML = `<img src="${mockupImage}" alt="${product.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            modalImage.innerHTML = '<div class="product-placeholder large">01</div>';
        }
        
        // Update size selector
        updateSizeSelector(product);
        
        // Attach add to cart listener
        attachAddToCartListener();
        
        // Show modal
        const modal = document.getElementById('productModal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Error opening modal:', error);
        showError('Failed to load product details');
    }
}

// Update size selector based on product variants (Printiful store products)
function updateSizeSelector(product) {
    const sizeSelector = document.getElementById('sizeSelector');
    
    // Check if variants is an array (full product) or just a count (summary)
    if (Array.isArray(product.variants) && product.variants.length > 0) {
        // Get sizes from sync_variants - name format is "Product Name / SIZE"
        const sizes = product.variants.map((v, index) => {
            // Extract size from name (e.g., "Unisex classic tee / S" -> "S")
            let size = 'S'; // Default
            if (v.name && v.name.includes(' / ')) {
                size = v.name.split(' / ').pop().trim();
            } else if (v.name) {
                // Try to extract size from name
                const sizeMatch = v.name.match(/\b([SMLX]{1,3})\b/i);
                if (sizeMatch) {
                    size = sizeMatch[1].toUpperCase();
                }
            }
            
            // Get variant ID and price
            const variantId = v.variant_id || v.id || index;
            const price = parseFloat(v.retail_price || v.price || 0);
            
            return { 
                size: size.toUpperCase(), 
                variantId: variantId,
                price: price,
                variant: v
            };
        });
        
        if (sizes.length > 0) {
            sizeSelector.innerHTML = sizes.map((item, index) => 
                `<button class="size-btn ${index === 0 ? 'active' : ''}" 
                    data-size="${item.size}" 
                    data-variant-id="${item.variantId}"
                    data-price="${item.price}">${item.size}</button>`
            ).join('');
            
            // Update price to first size's price
            if (sizes[0].price > 0) {
                const priceElement = document.getElementById('modalPrice');
                if (priceElement) {
                    priceElement.textContent = `$${sizes[0].price.toFixed(2)}`;
                }
            }
            
            // Re-attach size button listeners
            attachSizeListeners();
        } else {
            // Default sizes
            sizeSelector.innerHTML = `
                <button class="size-btn active" data-size="S">S</button>
                <button class="size-btn" data-size="M">M</button>
                <button class="size-btn" data-size="L">L</button>
                <button class="size-btn" data-size="XL">XL</button>
            `;
            attachSizeListeners();
        }
    } else {
        // Default sizes
        sizeSelector.innerHTML = `
            <button class="size-btn active" data-size="S">S</button>
            <button class="size-btn" data-size="M">M</button>
            <button class="size-btn" data-size="L">L</button>
            <button class="size-btn" data-size="XL">XL</button>
        `;
        attachSizeListeners();
    }
}

// Attach size button listeners
function attachSizeListeners() {
    const sizeButtons = document.querySelectorAll('.size-btn');
    sizeButtons.forEach(button => {
        button.addEventListener('click', function() {
            sizeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update price display when size changes
            const price = parseFloat(this.dataset.price || 0);
            const priceElement = document.getElementById('modalPrice');
            if (priceElement && price > 0) {
                priceElement.textContent = `$${price.toFixed(2)}`;
            }
        });
    });
}

// Close modal
function closeModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentProduct = null;
}

// Modal close handlers
const modalClose = document.querySelector('.modal-close');
const modal = document.getElementById('productModal');

if (modalClose) {
    modalClose.addEventListener('click', closeModal);
}

if (modal) {
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Close modal on ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
        closeModal();
    }
});

// Add to cart handler - prevent duplicate calls
let isAddingToCart = false;

// Add to cart handler function
async function handleAddToCart() {
    // Prevent duplicate calls
    if (isAddingToCart) {
        console.log('Already adding to cart, ignoring duplicate call');
        return;
    }
    
    isAddingToCart = true;
    
    try {
    console.log('handleAddToCart called');
    console.log('currentProduct:', currentProduct);
    
    if (!currentProduct) {
        console.error('No current product');
        showNotification('No product selected', 'error');
                return;
            }
            
    const activeSize = document.querySelector('.size-btn.active');
    if (!activeSize) {
        showNotification('Please select a size', 'error');
                return;
            }
            
    const size = activeSize.dataset.size;
    const variantId = activeSize.dataset.variantId;
    const variantPrice = activeSize.dataset.price;
    
    console.log('Adding to cart:', { size, variantId, variantPrice, product: currentProduct.name });
    
    // Find the variant in the product
    // Check if variants is an array (sync_variants)
    let variant = null;
    if (Array.isArray(currentProduct.variants) && currentProduct.variants.length > 0) {
        // Try to find by variant_id first, then by size in name
        variant = currentProduct.variants.find(v => {
            const vId = v.variant_id || v.id;
            return String(vId) === String(variantId) || 
                   v.name?.includes(` / ${size}`) ||
                   v.name?.includes(size);
        });
        
        // If not found, use first variant
        if (!variant) {
            variant = currentProduct.variants[0];
        }
    } else {
        console.warn('Variants is not an array:', currentProduct.variants);
    }
    
    // Get price from variant (retail_price is in dollars, convert to cents)
    let price = 2700; // Default $27 in cents
    if (variantPrice) {
        price = parseFloat(variantPrice) * 100;
    } else if (variant?.retail_price) {
        price = parseFloat(variant.retail_price) * 100;
    } else if (variant?.price) {
        price = parseFloat(variant.price) * 100;
    }
    
        const cartItem = {
            id: Date.now(), // Unique ID for cart item
            productId: currentProduct.id,
            name: currentProduct.name || 'Product',
            size: size,
            variantId: variant?.variant_id || variant?.id || variantId,
            syncVariantId: variant?.id, // Printful sync variant ID
            price: price, // Price in cents
            image: getProductMockup(currentProduct),
            quantity: 1
        };
    
    console.log('Cart item created:', cartItem);
    
    cart.push(cartItem);
    updateCartCount();
    updateCartDisplay();
    
    showNotification('Added to cart', 'success');
    
    // Button feedback
    const button = document.getElementById('addToCartBtn');
    if (button) {
        const originalText = button.textContent;
        button.textContent = 'ADDED';
        button.style.opacity = '0.7';
        button.disabled = true;
            
            setTimeout(() => {
            button.textContent = originalText;
            button.style.opacity = '1';
            button.disabled = false;
            }, 2000);
    }
    
        // Close modal after adding
        setTimeout(() => {
            closeModal();
        }, 1000);
    } finally {
        // Reset flag after a delay to prevent rapid clicks
        setTimeout(() => {
            isAddingToCart = false;
        }, 1000);
    }
}

// Single event listener for add to cart button
function attachAddToCartListener() {
    const addToCartBtn = document.getElementById('addToCartBtn');
    if (addToCartBtn) {
        // Remove all existing listeners by cloning
        const newBtn = addToCartBtn.cloneNode(true);
        addToCartBtn.parentNode.replaceChild(newBtn, addToCartBtn);
        
        // Attach single listener
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleAddToCart();
        });
    }
}

// Update cart count
function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        cartCount.textContent = cart.length;
        cartCount.style.display = cart.length > 0 ? 'flex' : 'none';
    }
}

// Cart icon click - open cart sidebar
const cartIcon = document.getElementById('cartIcon');
if (cartIcon) {
    cartIcon.addEventListener('click', function() {
        if (cart.length === 0) {
            showNotification('Cart is empty', 'error');
            return;
        }
        openCartSidebar();
    });
}

// Open cart sidebar
function openCartSidebar() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar) {
        cartSidebar.classList.add('active');
        if (cartOverlay) cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateCartDisplay();
        
        // Ensure calculate shipping button listener is attached
        setTimeout(() => {
            if (typeof attachCalculateShippingListener === 'function') {
                attachCalculateShippingListener();
            }
        }, 100);
    }
}

// Close cart sidebar
function closeCartSidebar() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
        if (cartOverlay) cartOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close cart on overlay click
const cartOverlay = document.getElementById('cartOverlay');
if (cartOverlay) {
    cartOverlay.addEventListener('click', closeCartSidebar);
}

// Cart close button
const cartClose = document.getElementById('cartClose');
if (cartClose) {
    cartClose.addEventListener('click', closeCartSidebar);
}

// Helper function to get value from address-input
function getShippingAddress1Value() {
    const element = document.getElementById('address-input');
    if (!element) {
        console.log('[getShippingAddress1Value] Element not found');
        return window.addressInputValue || '';
    }

    // For the new Places web component, we need to access the internal input in the shadow DOM
    let val = '';
    try {
        // FIRST: Use the tracked value from input events (most reliable)
        if (window.addressInputValue) {
            val = String(window.addressInputValue).trim();
            console.log('[getShippingAddress1Value] Got value from window.addressInputValue:', val);
        }
        
        // Second: Try the stored reference to internal input
        if (!val && window.internalAddressInput && window.internalAddressInput.value) {
            val = String(window.internalAddressInput.value).trim();
            window.addressInputValue = val; // Update tracked value
            console.log('[getShippingAddress1Value] Got value from window.internalAddressInput:', val);
        }
        
        // Third: Try to get value from the web component's value property
        if (!val) {
            // Try multiple ways to access the value
            if (element.value !== undefined && element.value !== null && element.value !== '') {
                val = String(element.value).trim();
                window.addressInputValue = val; // Update tracked value
                console.log('[getShippingAddress1Value] Got value from element.value:', val);
            } else if (element.getAttribute && element.getAttribute('value')) {
                val = String(element.getAttribute('value')).trim();
                window.addressInputValue = val; // Update tracked value
                console.log('[getShippingAddress1Value] Got value from getAttribute:', val);
            }
        }
        
        // Fourth: Access the shadow DOM input directly
        if (!val && element.shadowRoot) {
            const internalInput = element.shadowRoot.querySelector('input');
            if (internalInput && internalInput.value) {
                val = String(internalInput.value).trim();
                // Store reference for future use
                window.internalAddressInput = internalInput;
                window.addressInputValue = val; // Update tracked value
                console.log('[getShippingAddress1Value] Got value from shadow DOM input:', val);
            }
        }
        
        // Fifth: Try to find input in the component using querySelector
        if (!val) {
            const anyInput = element.querySelector('input');
            if (anyInput && anyInput.value) {
                val = String(anyInput.value).trim();
                window.internalAddressInput = anyInput;
                window.addressInputValue = val; // Update tracked value
                console.log('[getShippingAddress1Value] Got value from querySelector input:', val);
            }
        }
        
        // Sixth: Check if there's a getValue method
        if (!val && typeof element.getValue === 'function') {
            val = String(element.getValue()).trim();
            window.addressInputValue = val; // Update tracked value
            console.log('[getShippingAddress1Value] Got value from getValue():', val);
        }
        
        // Last resort: try to get the text content or innerText
        if (!val && element.textContent) {
            val = String(element.textContent).trim();
            window.addressInputValue = val; // Update tracked value
            console.log('[getShippingAddress1Value] Got value from textContent:', val);
        }
    } catch (e) {
        console.warn('[getShippingAddress1Value] Error reading address-input value:', e);
    }
    
    // Fallback to tracked value if nothing else worked
    if (!val && window.addressInputValue) {
        val = String(window.addressInputValue).trim();
        console.log('[getShippingAddress1Value] Using fallback tracked value:', val);
    }
    
    console.log('[getShippingAddress1Value] Final value:', val || '(empty)');

    return val || '';
}

// Calculate shipping from Printful
async function calculateShipping(showEstimate = false) {
    if (cart.length === 0) {
        shippingCost = 0;
        return;
    }
    
    // Get address from form - only required fields
    const address1 = getShippingAddress1Value()?.trim();
    const city = document.getElementById('city')?.value?.trim();
    const state = document.getElementById('province')?.value?.trim();
    const zip = document.getElementById('postal')?.value?.trim();
    const country = document.getElementById('shippingCountry')?.value?.trim();
    
    if (!address1 || !city || !state || !zip || !country) {
        if (showEstimate) {
            showNotification('Please fill in all shipping address fields', 'error');
        }
        shippingCost = 0;
        return;
    }
    
    // Normalize postal code: remove spaces and uppercase for CA, leave US as-is
    let normalizedZip = zip;
    if (country === 'CA') {
        normalizedZip = zip.replace(/\s+/g, '').toUpperCase();
    }
    
    try {
        // Build recipient object matching Printful requirements
        const recipient = {
            address1: address1,
            city: city,
            state_code: state,
            country_code: country,
            zip: normalizedZip
        };
        
        shippingAddress = recipient;
        
        const items = cart.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity
        }));
        
        console.log('[calculateShipping] Sending payload:', { recipient, items });
        
        const response = await fetch(`${API_BASE}/calculate-shipping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipient, items })
        });
        
        const data = await response.json();
        
        if (data.result && data.result.length > 0) {
            // Use the first (cheapest) shipping option
            const cheapestShipping = data.result[0];
            shippingCost = parseFloat(cheapestShipping.rate || 0) * 100; // Convert to cents
            selectedShippingRate = cheapestShipping;
            
            // Get delivery estimate - Printful returns min/max days
            if (cheapestShipping.estimated_days) {
                if (typeof cheapestShipping.estimated_days === 'object') {
                    shippingEstimate = {
                        min: cheapestShipping.estimated_days.min || cheapestShipping.estimated_days,
                        max: cheapestShipping.estimated_days.max || cheapestShipping.estimated_days
                    };
                } else {
                    // Single number
                    shippingEstimate = {
                        min: cheapestShipping.estimated_days,
                        max: cheapestShipping.estimated_days
                    };
                }
            } else if (cheapestShipping.min_days && cheapestShipping.max_days) {
                shippingEstimate = {
                    min: cheapestShipping.min_days,
                    max: cheapestShipping.max_days
                };
            }
            
            console.log('Shipping calculated:', shippingCost / 100, 'Estimate:', shippingEstimate);
            
            // Update shipping info display
            if (showEstimate) {
                updateShippingDisplay(cheapestShipping);
            }
            
            // Don't call updateCartDisplay here - let the button handler do it
            // This prevents the button text from being reset prematurely
            
            // Also trigger form completion check to enable checkout button
            if (typeof window.checkFormCompletion === 'function') {
                window.checkFormCompletion();
            }
        } else {
            shippingCost = 0;
            selectedShippingRate = null;
            shippingEstimate = null;
            console.warn('No shipping rates found');
            if (showEstimate) {
                showNotification('No shipping options available for this address', 'error');
            }
        }
    } catch (error) {
        console.error('Error calculating shipping:', error);
        shippingCost = 0;
        selectedShippingRate = null;
        shippingEstimate = null;
        if (showEstimate) {
            showNotification('Error calculating shipping', 'error');
        }
    }
}

// Update shipping display
function updateShippingDisplay(shippingRate) {
    const shippingInfo = document.getElementById('shippingInfo');
    const shippingMethod = document.getElementById('shippingMethod');
    const shippingCostDisplay = document.getElementById('shippingCost');
    const shippingEstimateDisplay = document.getElementById('shippingEstimate');
    
    if (shippingInfo && shippingRate) {
        shippingInfo.style.display = 'block';
        
        if (shippingMethod) {
            shippingMethod.textContent = shippingRate.name || shippingRate.service || 'Standard Shipping';
        }
        
        if (shippingCostDisplay) {
            shippingCostDisplay.textContent = `$${parseFloat(shippingRate.rate || 0).toFixed(2)}`;
        }
        
        if (shippingEstimateDisplay) {
            if (shippingEstimate) {
                const minDays = shippingEstimate.min;
                const maxDays = shippingEstimate.max;
                if (minDays === maxDays) {
                    shippingEstimateDisplay.textContent = `Estimated delivery: ${minDays} business days`;
                } else {
                    shippingEstimateDisplay.textContent = `Estimated delivery: ${minDays}-${maxDays} business days`;
                }
            } else {
                shippingEstimateDisplay.textContent = '';
            }
        }
    }
}

// Update cart display
async function updateCartDisplay() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const cartShipping = document.getElementById('cartShipping');
    
    if (!cartItems) return;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
        if (cartTotal) {
            cartTotal.innerHTML = '<div>TOTAL</div><div>$0.00</div>';
        }
        if (checkoutBtn) checkoutBtn.disabled = true;
        if (cartShipping) cartShipping.style.display = 'none';
        shippingCost = 0;
        return;
    }
    
    // Hide shipping form initially - show cart overview first (unless already shown)
    if (cartShipping && cartShipping.style.display !== 'block') {
        cartShipping.style.display = 'none';
    }
    
    // Only calculate shipping if address is provided
    if (shippingAddress) {
        await calculateShipping(false);
    } else {
        shippingCost = 0;
    }
    
    // Calculate subtotal
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal + shippingCost;
    
    if (cartTotal) {
        const subtotalText = `$${(subtotal / 100).toFixed(2)}`;
        let shippingText = '';
        if (shippingCost > 0) {
            shippingText = ` + $${(shippingCost / 100).toFixed(2)} shipping`;
            if (shippingEstimate) {
                const minDays = shippingEstimate.min;
                const maxDays = shippingEstimate.max;
                const estimateText = minDays === maxDays ? `${minDays} days` : `${minDays}-${maxDays} days`;
                shippingText += ` (${estimateText})`;
            }
        } else if (shippingAddress) {
            shippingText = ' (calculating...)';
        } else {
            shippingText = '';
        }
        cartTotal.innerHTML = `<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">Subtotal: ${subtotalText}${shippingText}</div><div style="font-size: 24px; font-weight: 600;">$${(total / 100).toFixed(2)}</div>`;
    }
    
    // Show proceed to shipping button if no address yet or shipping not calculated
    const proceedToShippingBtn = document.getElementById('proceedToShippingBtn');
    
    // If shipping form is visible, hide cart items
    if (cartShipping && cartShipping.style.display === 'block') {
        if (cartItems) {
            cartItems.style.display = 'none';
        }
    } else {
        if (cartItems) {
            cartItems.style.display = 'block';
        }
    }
    
    if (proceedToShippingBtn) {
        // Show this button whenever the shipping form has not been shown yet
        const cartShippingVisible = cartShipping && cartShipping.style.display === 'block';
        if (!cartShippingVisible) {
            proceedToShippingBtn.style.display = 'block';
            proceedToShippingBtn.textContent = 'PROCEED TO SHIPPING';
        } else {
            proceedToShippingBtn.style.display = 'none';
        }
    }
    
    if (checkoutBtn) {
        // Allow proceeding when all address fields are filled and we have a shipping quote
        const address1 = getShippingAddress1Value();
        const city = document.getElementById('city')?.value;
        const state = document.getElementById('province')?.value;
        const zip = document.getElementById('postal')?.value;
        const country = document.getElementById('shippingCountry')?.value;
        const allFieldsFilled = !!(address1 && city && state && zip && country);

        // Always show the button, just enable/disable it
        checkoutBtn.style.display = 'block';
        checkoutBtn.textContent = 'PROCEED TO CHECKOUT';
        
        if (allFieldsFilled && shippingCost > 0) {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = '1';
            checkoutBtn.style.pointerEvents = 'auto';
        } else {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.5';
            checkoutBtn.style.pointerEvents = 'none';
        }
    }
    
    // Render cart items
    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item" data-item-id="${item.id}">
            <div class="cart-item-image">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<div class="cart-item-placeholder">IMG</div>'}
            </div>
            <div class="cart-item-info">
                <h4>${item.name.toUpperCase()}</h4>
                <p>Size: ${item.size}</p>
                <p class="cart-item-price">$${(item.price / 100).toFixed(2)}</p>
            </div>
            <button class="cart-item-remove" data-item-id="${item.id}">&times;</button>
        </div>
    `).join('');
    
    // Attach remove buttons
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const itemId = parseInt(this.dataset.itemId);
            removeFromCart(itemId);
        });
    });
}

// Remove from cart
function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCartCount();
    updateCartDisplay();
    showNotification('Item removed from cart', 'success');
}

// Checkout button
const checkoutBtn = document.getElementById('checkoutBtn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async function() {
        if (cart.length === 0) return;
        await proceedToCheckout();
    });
}

// Calculate shipping button - attach listener when DOM is ready and when form becomes visible
function attachCalculateShippingListener() {
    const calculateShippingBtn = document.getElementById('calculateShippingBtn');
    if (calculateShippingBtn && !calculateShippingBtn.dataset.listenerAttached) {
        calculateShippingBtn.dataset.listenerAttached = 'true';
        calculateShippingBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[Calculate Shipping Button] Clicked');
            
            // Get address from form - only required fields
            const address1 = getShippingAddress1Value()?.trim();
            const city = document.getElementById('city')?.value?.trim();
            const state = document.getElementById('province')?.value?.trim();
            const zip = document.getElementById('postal')?.value?.trim();
            const country = document.getElementById('shippingCountry')?.value?.trim();
            
            console.log('[Calculate Shipping Button] Form values:', {
                address1: address1 || '(empty)',
                city: city || '(empty)',
                state: state || '(empty)',
                zip: zip || '(empty)',
                country: country || '(empty)'
            });
            
            // Validate required fields manually (don't rely on form validation)
            if (!address1 || !city || !state || !zip || !country) {
                showNotification('Please fill in all required shipping address fields', 'error');
                console.log('[Calculate Shipping Button] Validation failed - missing fields');
                return;
            }
            
            calculateShippingBtn.disabled = true;
            const originalText = calculateShippingBtn.textContent;
            calculateShippingBtn.textContent = 'CALCULATING...';
            
            try {
                await calculateShipping(true);
                
                // Reset button text immediately after calculation completes
                calculateShippingBtn.disabled = false;
                calculateShippingBtn.textContent = 'CALCULATE SHIPPING';
                
                // Update cart display after resetting button
                await updateCartDisplay();
            } catch (error) {
                console.error('[Calculate Shipping Button] Error:', error);
                showNotification('Error calculating shipping. Please try again.', 'error');
                
                // Reset button text on error
                calculateShippingBtn.disabled = false;
                calculateShippingBtn.textContent = 'CALCULATE SHIPPING';
            }
        });
        console.log('[Calculate Shipping Button] Listener attached');
    }
}

// Attach listener when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachCalculateShippingListener);
} else {
    attachCalculateShippingListener();
}

// Also attach when cart sidebar opens (in case button wasn't in DOM initially)
// We'll call attachCalculateShippingListener in openCartSidebar

// Auto-update shipping when address fields change (debounced)
let shippingUpdateTimeout;
const shippingInputs = ['city', 'province', 'postal', 'shippingCountry'];
shippingInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
        input.addEventListener('input', function() {
            clearTimeout(shippingUpdateTimeout);
            shippingUpdateTimeout = setTimeout(async () => {
                // Check if all required fields are filled
                const address1 = getShippingAddress1Value();
                const city = document.getElementById('city')?.value;
                const state = document.getElementById('province')?.value;
                const zip = document.getElementById('postal')?.value;
                const country = document.getElementById('shippingCountry')?.value;
                
                if (address1 && city && state && zip && country) {
                    await calculateShipping(true);
                    await updateCartDisplay();
                }
            }, 1500);
        });
        
        // Also listen for change events (for dropdowns)
        input.addEventListener('change', function() {
            clearTimeout(shippingUpdateTimeout);
            shippingUpdateTimeout = setTimeout(async () => {
                const address1 = getShippingAddress1Value();
                const city = document.getElementById('city')?.value;
                const state = document.getElementById('province')?.value;
                const zip = document.getElementById('postal')?.value;
                const country = document.getElementById('shippingCountry')?.value;
                
                if (address1 && city && state && zip && country) {
                    await calculateShipping(true);
                    await updateCartDisplay();
                }
            }, 500);
        });
    }
});

// Function to check and enable checkout button when all fields are filled
window.checkFormCompletion = function() {
        const address1 = getShippingAddress1Value();
        const city = document.getElementById('city')?.value?.trim();
        const state = document.getElementById('province')?.value?.trim();
        const zip = document.getElementById('postal')?.value?.trim();
        const country = document.getElementById('shippingCountry')?.value?.trim();
        
        console.log('[checkFormCompletion] ========================================');
        console.log('[checkFormCompletion] Checking form fields:', {
            address1: address1 || '(empty)',
            city: city || '(empty)',
            state: state || '(empty)',
            zip: zip || '(empty)',
            country: country || '(empty)'
        });
        
        // Only require: address1, city, state_code, country_code, zip
        const allFieldsFilled = !!(address1 && city && state && zip && country);
        const checkoutBtn = document.getElementById('checkoutBtn');
        
        // Check shipping cost from the global variable
        const currentShippingCost = typeof shippingCost !== 'undefined' ? shippingCost : 0;
        
        console.log('[checkFormCompletion] All fields filled:', allFieldsFilled);
        console.log('[checkFormCompletion] Shipping cost:', currentShippingCost);
        console.log('[checkFormCompletion] Checkout button element:', checkoutBtn);
        
        if (checkoutBtn) {
            if (allFieldsFilled && currentShippingCost > 0) {
                checkoutBtn.disabled = false;
                checkoutBtn.style.display = 'block';
                checkoutBtn.textContent = 'PROCEED TO CHECKOUT';
                console.log('[checkFormCompletion] ✓✓✓ Checkout button ENABLED ✓✓✓');
            } else {
                checkoutBtn.disabled = true;
                checkoutBtn.style.display = 'none';
            }
        } else {
            console.error('[checkFormCompletion] ✗ Checkout button element not found!');
        }
        console.log('[checkFormCompletion] ========================================');
    };

// Handle PlaceAutocompleteElement input events separately (it's a web component)
document.addEventListener('DOMContentLoaded', function() {
    // Wait for autocomplete to be initialized, then add listener
    const checkForAutocomplete = setInterval(() => {
        const addressInput = document.getElementById('address-input');
        if (addressInput && window.autocompleteInstance) {
            clearInterval(checkForAutocomplete);
            
            // Listen for input events on the address input
            addressInput.addEventListener('input', function() {
                clearTimeout(shippingUpdateTimeout);
                shippingUpdateTimeout = setTimeout(async () => {
                    const address1 = getShippingAddress1Value();
                    const city = document.getElementById('city')?.value;
                    const state = document.getElementById('province')?.value;
                    const zip = document.getElementById('postal')?.value;
                    const country = document.getElementById('shippingCountry')?.value;
                    
                    if (address1 && city && state && zip && country) {
                        await calculateShipping(true);
                        await updateCartDisplay();
                    }
                }, 1500);
            });
        }
    }, 500);
    
    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkForAutocomplete), 10000);
    
    // Check form completion whenever any field changes (only required fields)
    const formFields = ['city', 'province', 'postal', 'shippingCountry'];
    formFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('input', window.checkFormCompletion);
            field.addEventListener('change', window.checkFormCompletion);
        }
    });
    
    // Also check when address input changes
    const addressInputCheck = document.getElementById('address-input');
    if (addressInputCheck) {
        // Listen for input events on the address field
        addressInputCheck.addEventListener('input', () => {
            setTimeout(window.checkFormCompletion, 100);
        });
        // Listen for place selection events
        addressInputCheck.addEventListener('gmp-placeautocomplete-placeupdated', () => {
            setTimeout(window.checkFormCompletion, 100);
        });
    }
});

// Proceed to Stripe checkout
async function proceedToCheckout() {
    if (!stripe) {
        showError('Stripe not initialized. Please add your Stripe publishable key in script.js');
        return;
    }
    
    if (cart.length === 0) {
        showError('Cart is empty');
        return;
    }
    
    try {
        showNotification('Processing checkout...', 'success');
        closeCartSidebar();
        
        // Calculate total including shipping
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalWithShipping = subtotal + shippingCost;
        
        const items = cart.map(item => ({
            name: `${item.name} - Size ${item.size}`,
            price: item.price / 100, // Convert cents to dollars
            quantity: item.quantity,
            images: item.image ? [item.image] : []
        }));
        
        // Add shipping as a line item
        if (shippingCost > 0) {
            items.push({
                name: 'Shipping',
                price: shippingCost / 100,
                quantity: 1,
                images: []
            });
        }
        
        // Prepare cart items for Printful (with variant IDs)
        const printfulItems = cart.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            name: item.name,
            size: item.size
        }));
        
        const response = await fetch(`${API_BASE}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: items,
                shippingAddress: shippingAddress,
                cartItems: printfulItems, // For Printful order creation
                shippingMethod: selectedShippingRate ? {
                    id: selectedShippingRate.id,
                    name: selectedShippingRate.name || selectedShippingRate.service,
                    rate: selectedShippingRate.rate
                } : null,
                successUrl: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: window.location.href
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        if (data.sessionId) {
            // Redirect to Stripe Checkout
            const result = await stripe.redirectToCheckout({
                sessionId: data.sessionId
            });
            
            if (result.error) {
                showError(result.error.message);
            }
        } else if (data.url) {
            // Direct redirect if URL provided
            window.location.href = data.url;
        } else {
            showError('Failed to create checkout session');
        }
    } catch (error) {
        console.error('Checkout error:', error);
        showError('Failed to process checkout');
    }
}
    
    // Notification system
function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
    notification.className = 'notification';
        notification.textContent = message;
    
    const styles = {
        position: 'fixed',
        top: '100px',
        right: '60px',
        background: type === 'success' ? '#ffffff' : '#ff4444',
        color: type === 'success' ? '#0a0a0a' : '#ffffff',
        padding: '20px 30px',
        fontSize: '12px',
        letterSpacing: '2px',
        zIndex: '3000',
        fontFamily: 'Inter, sans-serif',
        fontWeight: '400',
        textTransform: 'uppercase',
        transform: 'translateX(400px)',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
    };
    
    Object.assign(notification.style, styles);
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 400);
        }, 3000);
    }
    
function showError(message) {
    showNotification(message, 'error');
}

// Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
// Observe product items after they're rendered
setTimeout(() => {
    document.querySelectorAll('.product-item').forEach(item => {
        observer.observe(item);
    });
}, 1000);

// State/Province data
const statesByCountry = {
    'US': [
        { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
        { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
        { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
        { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
        { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
        { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
        { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
        { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
        { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
        { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
        { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
        { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
        { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
        { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
        { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
        { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
        { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
    ],
    'CA': [
        { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' }, { code: 'MB', name: 'Manitoba' },
        { code: 'NB', name: 'New Brunswick' }, { code: 'NL', name: 'Newfoundland and Labrador' },
        { code: 'NS', name: 'Nova Scotia' }, { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' },
        { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' },
        { code: 'QC', name: 'Quebec' }, { code: 'SK', name: 'Saskatchewan' }, { code: 'YT', name: 'Yukon' }
    ],
    'AU': [
        { code: 'NSW', name: 'New South Wales' }, { code: 'VIC', name: 'Victoria' }, { code: 'QLD', name: 'Queensland' },
        { code: 'WA', name: 'Western Australia' }, { code: 'SA', name: 'South Australia' }, { code: 'TAS', name: 'Tasmania' },
        { code: 'ACT', name: 'Australian Capital Territory' }, { code: 'NT', name: 'Northern Territory' }
    ]
};

// Update state dropdown based on country
function updateStateDropdown(country) {
    const stateSelect = document.getElementById('province');
    if (!stateSelect) return;
    
    // Check if it's a select element, if not create one
    if (stateSelect.tagName !== 'SELECT') {
        const parent = stateSelect.parentNode;
        const newSelect = document.createElement('select');
        newSelect.id = 'province';
        newSelect.required = true;
        parent.replaceChild(newSelect, stateSelect);
        return updateStateDropdown(country);
    }
    
    if (country && statesByCountry[country]) {
        stateSelect.disabled = false;
        stateSelect.innerHTML = '<option value="">Select State/Province</option>';
        statesByCountry[country].forEach(state => {
            const option = document.createElement('option');
            option.value = state.code;
            option.textContent = state.name;
            stateSelect.appendChild(option);
        });
    } else if (country) {
        // Country selected but no predefined states - use text input
        stateSelect.disabled = false;
        stateSelect.innerHTML = '<option value="">Enter State/Province</option>';
    } else {
        // No country selected
        stateSelect.disabled = true;
        stateSelect.innerHTML = '<option value="">Select Country First</option>';
    }
}

// Initialize Google Places Autocomplete using new PlaceAutocompleteElement API
// IMPORTANT: We do NOT create new google.maps.places.Autocomplete() - that's the OLD API
// The <gmp-place-autocomplete> web component works automatically - we just set up event listeners
// Make it globally available for the Google Maps script callback
window.initGoogle = function initGoogle(force = false) {
    console.log('[initGoogle] Starting initialization, force:', force);
    
    const addressElement = document.getElementById('address-input');
    if (!addressElement) {
        console.warn('[initGoogle] Address element not found, retrying in 1s...');
        setTimeout(() => initGoogle(force), 1000);
        return;
    }
    
    // Verify it's actually the web component
    if (addressElement.localName !== 'gmp-place-autocomplete') {
        console.error('[initGoogle] ERROR: Element is not gmp-place-autocomplete! It is:', addressElement.localName);
        console.error('[initGoogle] This means the HTML is wrong - check index.html');
        return;
    }
    
    console.log('[initGoogle] ✓ Found gmp-place-autocomplete element');
    
    // Check if the input is visible - wait if not visible (unless forced)
    const cartShipping = document.getElementById('cartShipping');
    const isVisible = cartShipping && window.getComputedStyle(cartShipping).display !== 'none';
    
    if (!isVisible && !force) {
        console.log('[initGoogle] Address input is not visible yet, will initialize when form is shown');
        return;
    }
    
    // Check that Google Maps script is loaded
    // The <gmp-place-autocomplete> web component is automatically upgraded by Google's script
    if (typeof google === 'undefined' || !google.maps) {
        console.warn('[initGoogle] Google Maps script not loaded yet, retrying in 1s...');
        setTimeout(() => initGoogle(force), 1000);
        return;
    }
    
    console.log('[initGoogle] ✓ Google Maps script loaded');
    
    // Don't reinitialize if already initialized (unless forced)
    if (!force && addressElement.dataset.autocompleteInitialized === 'true') {
        console.log('[initGoogle] Already initialized, skipping');
        return;
    }
    
    try {
        console.log('[initGoogle] Setting up event listeners for gmp-place-autocomplete web component...');
        console.log('[initGoogle] NOTE: We do NOT call new google.maps.places.Autocomplete() - that is the OLD API');

        // The <gmp-place-autocomplete> element is automatically upgraded by Google's script
        // We just need to set up event listeners - NO JavaScript initialization needed
        const addressInput = addressElement;

        // Verify element is actually in the DOM and visible
        const inputRect = addressInput.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(addressInput);
        const isInputVisible = inputRect.width > 0 && inputRect.height > 0 && 
                               computedStyle.visibility !== 'hidden' &&
                               computedStyle.display !== 'none';
        
        console.log('[initGoogle] Input element:', addressInput);
        console.log('[initGoogle] Input dimensions:', inputRect.width, 'x', inputRect.height);
        console.log('[initGoogle] Input computed style:', {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity
        });
        console.log('[initGoogle] Input is visible:', isInputVisible);
        console.log('[initGoogle] Input value:', addressInput.value);
        console.log('[initGoogle] Input placeholder:', addressInput.placeholder);
        
        if (!isInputVisible) {
            console.warn('[initGoogle] WARNING: Input is not visible, autocomplete may not work properly');
        }
        
        // Check if the element is a custom element
        if (addressInput.localName !== 'gmp-place-autocomplete') {
            console.warn('[initGoogle] WARNING: Element is not gmp-place-autocomplete, it is:', addressInput.localName);
        }
        
        // Check if custom element is defined
        if (customElements && !customElements.get('gmp-place-autocomplete')) {
            console.warn('[initGoogle] WARNING: gmp-place-autocomplete custom element is not defined');
        }
        
        // Component restrictions are set via HTML attribute, not programmatically
        // The HTML already has: component-restrictions='{"country":["us","ca"]}'
        // So we don't need to set it here - the error is expected and harmless
        console.log('[initGoogle] Component restrictions are set via HTML attribute');
        
        // Mark as initialized
        addressInput.dataset.autocompleteInitialized = 'true';
        
        // Store reference to the web component (NOT an Autocomplete instance)
        window.autocompleteInstance = addressInput;
        
        console.log('[initGoogle] ✓ gmp-place-autocomplete web component ready');
        console.log('[initGoogle] Element:', addressInput);
        
        // The gmp-place-autocomplete element should work automatically once Google's script loads
        // We just need to ensure it's properly set up and listen for events
        console.log('[initGoogle] Component should be automatically initialized by Google Maps script');
        
        // Verify component is working by checking its properties
        console.log('[initGoogle] Component properties:', {
            tagName: addressInput.tagName,
            id: addressInput.id,
            hasShadowRoot: !!addressInput.shadowRoot,
            isConnected: addressInput.isConnected,
            placeholder: addressInput.getAttribute('placeholder'),
            region: addressInput.getAttribute('region')
        });
        
        // Ensure region attribute is set (defaults to CA)
        if (!addressInput.getAttribute('region')) {
            console.log('[initGoogle] Setting default region to CA');
            addressInput.setAttribute('region', 'CA');
        }
        
        // Dynamic region switching: Switch between CA and US based on user input
        // If user types something that starts with a number (US ZIP style), switch to US region
        const setupDynamicRegionSwitching = () => {
            if (addressInput.shadowRoot) {
                const internalInput = addressInput.shadowRoot.querySelector('input');
                if (internalInput) {
                    console.log('[initGoogle] ✓ Found internal input in shadow DOM');
                    window.internalAddressInput = internalInput;
                    
                    // Verify the input is functional
                    console.log('[initGoogle] Internal input properties:', {
                        type: internalInput.type,
                        placeholder: internalInput.placeholder,
                        disabled: internalInput.disabled,
                        readOnly: internalInput.readOnly
                    });
                    
                    // Listen to input events on shadow DOM input (secondary method)
                    // The primary region switching is handled on the web component itself
                    internalInput.addEventListener('input', (e) => {
                        const value = (e.target.value || '').trim();
                        // Store the value globally for retrieval
                        window.addressInputValue = value;
                        console.log('[Address Input] User typed (shadow DOM):', value);
                        
                        // After user types, check if suggestions appear
                        setTimeout(() => {
                            const hasSuggestions = 
                                addressInput.shadowRoot.querySelector('[role="listbox"]') ||
                                document.body.querySelector('[role="listbox"]') ||
                                document.querySelector('.pac-container');
                            
                            if (!hasSuggestions && value.length >= 3) {
                                console.warn('[Address Input] No suggestions found after typing. This could indicate:');
                                console.warn('  1. Places API (New) is not enabled for this API key');
                                console.warn('  2. Billing is not enabled for the Google Cloud project');
                                console.warn('  3. API key restrictions are blocking the request');
                            }
                        }, 1000);
                    });
                    
                    // Listen for focus to verify component is interactive
                    internalInput.addEventListener('focus', () => {
                        console.log('[Address Input] Field focused - component is interactive');
                    });
                } else {
                    console.warn('[initGoogle] ✗ Shadow root exists but no input found');
                }
            } else {
                console.warn('[initGoogle] ✗ No shadow root - component may not be fully upgraded yet');
            }
        };
        
        // Try to access shadow DOM after delays to ensure component is upgraded
        setupDynamicRegionSwitching();
        setTimeout(setupDynamicRegionSwitching, 500);
        setTimeout(setupDynamicRegionSwitching, 1500);
        
        // Store the address value directly as user types (fallback since web component value isn't readable)
        window.addressInputValue = '';
        
        // Listen for input events on the web component itself for dynamic region switching
        // This is the primary method - works even if shadow DOM isn't accessible
        addressInput.addEventListener('input', (e) => {
            // Try to get the value from the event
            let value = '';
            if (e.target && e.target.value) {
                value = String(e.target.value).trim();
            } else if (e.data) {
                // If we have the data from the input event, reconstruct the value
                const currentValue = window.addressInputValue || '';
                if (e.inputType === 'insertText' && e.data) {
                    value = currentValue + e.data;
                } else if (e.inputType === 'deleteContentBackward') {
                    value = currentValue.slice(0, -1);
                } else {
                    value = currentValue;
                }
            }
            
            // Store the value globally for later retrieval
            if (value) {
                window.addressInputValue = value;
            }
            
            console.log('[Address Input] Input event on web component, value:', value || '(empty)');
            
            // If starts with a number → likely US ZIP style, switch to US region
            if (value) {
                const isUS = /^[0-9]/.test(value);
                const newRegion = isUS ? 'US' : 'CA';
                const currentRegion = addressInput.getAttribute('region');
                
                if (currentRegion !== newRegion) {
                    console.log(`[Address Input] Switching region from ${currentRegion} to ${newRegion}`);
                    addressInput.setAttribute('region', newRegion);
                }
            }
        });
        
        // Also listen for focus to check initialization
        addressInput.addEventListener('focus', () => {
            console.log('[Address Input] Field focused');
            console.log('[Address Input] Current value:', addressInput.value);
            console.log('[Address Input] Current region:', addressInput.getAttribute('region'));
            console.log('[Address Input] Is initialized:', addressInput.dataset.autocompleteInitialized);
        });
        
        // Ensure input is properly connected when focused
        addressInput.addEventListener('focus', () => {
            console.log('Address input focused');
            // Force autocomplete to be active
            if (window.autocompleteInstance) {
                console.log('Autocomplete instance available on focus');
            }
        });
        
        // Monitor for dropdown appearance
        const dropdownObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // Check for pac-container
                        if (node.classList && node.classList.contains('pac-container')) {
                            console.log('PAC container added to DOM!', node);
                            // Force visibility
                            node.style.cssText += 'z-index: 999999 !important; position: fixed !important; display: block !important; visibility: visible !important; opacity: 1 !important;';
                        }
                        // Check for any element with pac- in class name
                        if (node.classList) {
                            Array.from(node.classList).forEach(className => {
                                if (className.includes('pac-')) {
                                    console.log('Found PAC element:', className, node);
                                }
                            });
                        }
                        // Check children for pac-container
                        const pacChild = node.querySelector && node.querySelector('.pac-container');
                        if (pacChild) {
                            console.log('Found PAC container in child:', pacChild);
                            pacChild.style.cssText += 'z-index: 999999 !important; position: fixed !important; display: block !important; visibility: visible !important; opacity: 1 !important;';
                        }
                    }
                });
            });
        });
        
        dropdownObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Keep observer active for 5 minutes
        setTimeout(() => dropdownObserver.disconnect(), 300000);
        
        // Style the autocomplete dropdown to match our theme
        // The new API might use shadow DOM or different structure
        const styleAutocompleteDropdown = () => {
            // Remove any existing autocomplete styles first
            const existingStyle = document.getElementById('places-autocomplete-style');
            if (existingStyle) {
                existingStyle.remove();
            }
            
            const style = document.createElement('style');
            style.id = 'places-autocomplete-style';
            style.textContent = `
                /* Style for the new PlaceAutocompleteElement dropdown - try multiple selectors */
                .pac-container,
                gmp-place-autocomplete::part(suggestions),
                gmp-place-autocomplete .pac-container,
                [role="listbox"],
                .gmp-autocomplete-suggestions {
                    background: var(--bg-dark) !important;
                    border: 1px solid var(--border) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
                    z-index: 999999 !important;
                    font-family: 'Inter', sans-serif !important;
                    position: fixed !important;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                    max-height: 300px !important;
                    overflow-y: auto !important;
                }
                .pac-item,
                gmp-place-autocomplete::part(suggestion-item),
                [role="option"] {
                    background: var(--bg-dark) !important;
                    color: var(--text-primary) !important;
                    padding: 12px !important;
                    border-top: 1px solid var(--border) !important;
                    cursor: pointer !important;
                }
                .pac-item:hover,
                [role="option"]:hover {
                    background: rgba(255, 255, 255, 0.1) !important;
                }
                .pac-item-selected,
                [role="option"][aria-selected="true"] {
                    background: rgba(255, 255, 255, 0.15) !important;
                }
                /* Ensure the dropdown is visible above everything */
                body > .pac-container,
                body > [role="listbox"] {
                    z-index: 999999 !important;
                }
            `;
            document.head.appendChild(style);
        };
        styleAutocompleteDropdown();
        
        // Add event listener for place updated on the web component
        // Hybrid Method: Allow all suggestions, then validate country after selection
        // This works around Google's limitation of only accepting one country code in the element
        console.log('[initGoogle] Attaching gmp-placeautocomplete-placeupdated event listener');
        
        // Test: Listen for ANY events on the element to see what fires
        const testAllEvents = ['gmp-placeautocomplete-placeupdated', 'place_changed', 'placechange', 'change', 'input'];
        testAllEvents.forEach(eventName => {
            addressInput.addEventListener(eventName, (e) => {
                console.log(`[Event Test] Event "${eventName}" fired on addressInput:`, e);
                console.log(`[Event Test] Event detail:`, e.detail);
                console.log(`[Event Test] Event target:`, e.target);
            }, { once: false });
        });
        
        // Track previous value to detect when user selects from suggestions
        let previousAddressValue = '';
        let addressValueCheckInterval = null;
        
        // Poll for address value changes (fallback if event doesn't fire)
        const startAddressValuePolling = () => {
            if (addressValueCheckInterval) {
                clearInterval(addressValueCheckInterval);
            }
            
            addressValueCheckInterval = setInterval(() => {
                const currentValue = getShippingAddress1Value();
                
                // If value changed and is not empty, and we have a substantial value (user selected something)
                if (currentValue && currentValue !== previousAddressValue && currentValue.length > 5) {
                    console.log('[Address Polling] Address value changed, checking for place data...');
                    previousAddressValue = currentValue;
                    
                    // Try to get place data
                    setTimeout(() => {
                        if (typeof addressInput.getPlace === 'function') {
                            try {
                                const place = addressInput.getPlace();
                                console.log('[Address Polling] Got place from getPlace():', place);
                                if (place && place.addressComponents) {
                                    // Manually trigger place selection processing
                                    console.log('[Address Polling] Dispatching place selection handler');
                                    handlePlaceSelection({ detail: { place: place }, type: 'gmp-placeautocomplete-placeupdated' });
                                }
                            } catch (err) {
                                console.warn('[Address Polling] getPlace() failed:', err);
                            }
                        }
                    }, 300);
                }
            }, 500);
        };
        
        // Start polling when input is focused
        addressInput.addEventListener('focus', () => {
            console.log('[Address Input] Focused, starting value polling');
            startAddressValuePolling();
        });
        
        // Also listen on the shadow DOM input if available
        const setupShadowDOMListener = () => {
            if (addressInput.shadowRoot) {
                const internalInput = addressInput.shadowRoot.querySelector('input');
                if (internalInput) {
                    console.log('[initGoogle] Setting up shadow DOM input listener');
                    
                    // Listen for blur event (when user selects a suggestion)
                    internalInput.addEventListener('blur', (e) => {
                        console.log('[Shadow DOM] Blur event on internal input');
                        setTimeout(() => {
                            const value = getShippingAddress1Value();
                            if (value && value.length > 5) {
                                console.log('[Shadow DOM] Value after blur:', value);
                                if (typeof addressInput.getPlace === 'function') {
                                    try {
                                        const place = addressInput.getPlace();
                                        console.log('[Shadow DOM] Got place from getPlace() after blur:', place);
                                        if (place && place.addressComponents) {
                                            if (typeof window.handlePlaceSelection === 'function') {
                                                window.handlePlaceSelection({ detail: { place: place }, type: 'gmp-placeautocomplete-placeupdated' });
                                            }
                                        }
                                    } catch (err) {
                                        console.warn('[Shadow DOM] getPlace() failed:', err);
                                    }
                                }
                            }
                        }, 500);
                    });
                    
                    // Listen for change event
                    internalInput.addEventListener('change', (e) => {
                        console.log('[Shadow DOM] Change event on internal input:', e.target.value);
                        setTimeout(() => {
                            if (typeof addressInput.getPlace === 'function') {
                                try {
                                    const place = addressInput.getPlace();
                                    console.log('[Shadow DOM] Got place from getPlace():', place);
                                    if (place && place.addressComponents) {
                                        if (typeof window.handlePlaceSelection === 'function') {
                                            window.handlePlaceSelection({ detail: { place: place }, type: 'gmp-placeautocomplete-placeupdated' });
                                        }
                                    }
                                } catch (err) {
                                    console.warn('[Shadow DOM] getPlace() failed:', err);
                                }
                            }
                        }, 300);
                    });
                }
            } else {
                // If no shadow root, try to access the input directly
                console.log('[initGoogle] No shadow root, trying direct input access');
            }
        };
        setupShadowDOMListener();
        setTimeout(setupShadowDOMListener, 500);
        setTimeout(setupShadowDOMListener, 1500);
        setTimeout(setupShadowDOMListener, 3000);
        
        // Main event listener for place selection - extracted to function so it can be called from multiple places
        window.handlePlaceSelection = function(e) {
            console.log('[Place Selection] ========================================');
            console.log('[Place Selection] Place updated event fired - user selected an address');
            console.log('[Place Selection] Event type:', e.type);
            console.log('[Place Selection] Event object:', e);
            console.log('[Place Selection] Event detail:', e.detail);
            
            // Try to get place from event detail first
            let place = e.detail?.place;
            
            // Also try e.detail directly if it's a Place object
            if (!place && e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail)) {
                // Check if detail itself is the place object
                if (e.detail.addressComponents || e.detail.formattedAddress || e.detail.name) {
                    place = e.detail;
                    console.log('[Place Selection] Using e.detail as place object');
                }
            }
            
            // If not available, try getting from element value (as in user's example)
            if (!place && addressInput.value) {
                console.log('[Place Selection] Trying to get place from addressInput.value');
                if (typeof addressInput.value === 'object') {
                    place = addressInput.value;
                }
            }
            
            // Try getPlace method if available
            if (!place && typeof addressInput.getPlace === 'function') {
                console.log('[Place Selection] Trying getPlace() method');
                try {
                    place = addressInput.getPlace();
                    console.log('[Place Selection] getPlace() returned:', place);
                } catch (err) {
                    console.warn('[Place Selection] getPlace() failed:', err);
                }
            }
            
            // Try accessing place from the element's value property
            if (!place && addressInput.value) {
                console.log('[Place Selection] Checking addressInput.value:', addressInput.value);
                if (typeof addressInput.value === 'object' && addressInput.value.addressComponents) {
                    place = addressInput.value;
                    console.log('[Place Selection] Found place in addressInput.value');
                }
            }
            
            if (!place) {
                console.error('[Place Selection] Could not retrieve place data from any source');
                console.error('[Place Selection] Available properties on addressInput:', Object.keys(addressInput));
                console.error('[Place Selection] addressInput.value:', addressInput.value);
                console.error('[Place Selection] addressInput.getPlace:', typeof addressInput.getPlace);
                return;
            }
            
            console.log('[Place Selection] Place object:', place);
            console.log('[Place Selection] Place keys:', Object.keys(place));
            
            // Extract country code from address components
            let addressCountry = null;
            const allowedCountries = ['US', 'CA'];
            
            // Try multiple ways to access address components
            const placeAddressComponents = place.addressComponents;
            
            console.log('[Place Selection] Address components:', placeAddressComponents);
            console.log('[Place Selection] Address components type:', typeof placeAddressComponents);
            console.log('[Place Selection] Is array?', Array.isArray(placeAddressComponents));
            
            // If addressComponents is an object with countryCode property (as in user's example)
            if (placeAddressComponents && typeof placeAddressComponents === 'object' && !Array.isArray(placeAddressComponents)) {
                if (placeAddressComponents.countryCode) {
                    addressCountry = String(placeAddressComponents.countryCode).toUpperCase();
                    console.log('[Place Selection] Found countryCode in addressComponents object:', addressCountry);
                }
            }
            
            // If not found yet, try array format
            if (!addressCountry && Array.isArray(placeAddressComponents)) {
                const countryComponent = placeAddressComponents.find(comp => 
                    comp.types && comp.types.includes('country')
                );
                if (countryComponent) {
                    // Try different property names for country code
                    addressCountry = (
                        countryComponent.shortText || 
                        countryComponent.short_name || 
                        countryComponent.shortName ||
                        ''
                    ).toUpperCase();
                    console.log('[Place Selection] Found country from array component:', addressCountry);
                }
            }
            
            console.log('[Place Selection] Final detected country code:', addressCountry);
            
            // Validate: Only allow US and Canada
            if (!addressCountry || !allowedCountries.includes(addressCountry)) {
                console.warn('[Place Selection] Address is not in US or CA, rejecting:', addressCountry);
                alert('Please enter an address in Canada or the United States.');
                
                // Clear the input value - try multiple methods
                if (window.internalAddressInput) {
                    window.internalAddressInput.value = '';
                }
                if (addressInput.value !== undefined && addressInput.value !== null) {
                    addressInput.value = '';
                }
                // Also clear any form fields that might have been populated
                const cityInput = document.getElementById('city');
                const provinceSelect = document.getElementById('province');
                const postalInput = document.getElementById('postal');
                if (cityInput) cityInput.value = '';
                if (provinceSelect) provinceSelect.value = '';
                if (postalInput) postalInput.value = '';
                return;
            }
            
            console.log('[Place Selection] ✓ Address is in allowed country:', addressCountry);
            
            // Extract address components - handle both array and object formats
            const addressComponents = placeAddressComponents;
            console.log('[Place Selection] Raw addressComponents:', addressComponents);
            
            // Build address object from components
            const addressObj = {
                address1: '', // street_number + route
                locality: '', // city
                administrativeArea: '', // state_code (short_name)
                postalCode: '', // postal_code
                country: null // country (short_name)
            };
            
            // Handle array format (most common)
            if (Array.isArray(addressComponents)) {
                console.log('[Place Selection] Processing addressComponents as array');
                
                let streetNumber = '';
                let route = '';
                
                addressComponents.forEach(component => {
                    const types = component.types || [];
                    console.log('[Place Selection] Component:', component, 'Types:', types);
                    
                    // Try multiple property names for values
                    const longValue = component.longText || component.long_name || '';
                    const shortValue = component.shortText || component.short_name || '';
                    
                    if (types.includes('street_number')) {
                        streetNumber = longValue || shortValue;
                        console.log('[Place Selection] Found street_number:', streetNumber);
                    } else if (types.includes('route')) {
                        route = longValue || shortValue;
                        console.log('[Place Selection] Found route:', route);
                    } else if (types.includes('locality') || types.includes('postal_town')) {
                        addressObj.locality = longValue || shortValue;
                        console.log('[Place Selection] Found city:', addressObj.locality);
                    } else if (types.includes('administrative_area_level_1')) {
                        // Use short_name for state_code
                        addressObj.administrativeArea = shortValue || longValue;
                        console.log('[Place Selection] Found province/state:', addressObj.administrativeArea);
                    } else if (types.includes('postal_code')) {
                        addressObj.postalCode = longValue || shortValue;
                        console.log('[Place Selection] Found postal code:', addressObj.postalCode);
                    } else if (types.includes('country')) {
                        // Use short_name for country_code
                        addressObj.country = {
                            code: (shortValue || '').toUpperCase(),
                            name: longValue || ''
                        };
                        console.log('[Place Selection] Found country:', addressObj.country);
                    }
                });
                
                // Build address1 from street_number + route
                if (streetNumber && route) {
                    addressObj.address1 = `${streetNumber} ${route}`.trim();
                } else if (route) {
                    addressObj.address1 = route;
                } else if (streetNumber) {
                    addressObj.address1 = streetNumber;
                } else {
                    // Fallback: use the formatted address from place
                    addressObj.address1 = place.formattedAddress || place.name || '';
                }
                console.log('[Place Selection] Built address1:', addressObj.address1);
            } else if (addressComponents && typeof addressComponents === 'object') {
                // Handle object format
                console.log('[Place Selection] Processing addressComponents as object');
                if (addressComponents.locality) addressObj.locality = addressComponents.locality;
                if (addressComponents.administrativeArea) addressObj.administrativeArea = addressComponents.administrativeArea;
                if (addressComponents.postalCode) addressObj.postalCode = addressComponents.postalCode;
                if (addressComponents.country) addressObj.country = addressComponents.country;
                if (addressComponents.address1) {
                    addressObj.address1 = addressComponents.address1;
                } else {
                    addressObj.address1 = place.formattedAddress || place.name || '';
                }
            }
            
            console.log('[Place Selection] Extracted address object:', addressObj);
            
            // Populate address1 field (street_number + route)
            if (addressObj.address1) {
                // Update the gmp-place-autocomplete value
                if (window.internalAddressInput) {
                    window.internalAddressInput.value = addressObj.address1;
                }
                if (addressInput.value !== undefined && addressInput.value !== null) {
                    addressInput.value = addressObj.address1;
                }
                console.log('[Place Selection] ✓ Set address1:', addressObj.address1);
            }
            
            // Populate city field
            const cityInput = document.getElementById('city');
            if (cityInput && addressObj.locality) {
                cityInput.value = addressObj.locality;
                console.log('[Place Selection] ✓ Populated city:', addressObj.locality);
                // Trigger input event to ensure form validation
                cityInput.dispatchEvent(new Event('input', { bubbles: true }));
                cityInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (cityInput && !addressObj.locality) {
                console.warn('[Place Selection] ⚠ City not found in address components');
            }
            
            // Populate postal code field with normalization
            const postalInput = document.getElementById('postal');
            if (postalInput && addressObj.postalCode) {
                // Normalize postal code: remove spaces and uppercase for CA, leave US as-is
                let normalizedPostal = addressObj.postalCode;
                const countryCode = addressObj.country?.code || addressCountry;
                if (countryCode === 'CA') {
                    normalizedPostal = addressObj.postalCode.replace(/\s+/g, '').toUpperCase();
                }
                postalInput.value = normalizedPostal;
                console.log('[Place Selection] ✓ Populated postal code (normalized):', normalizedPostal);
                // Trigger input event to ensure form validation
                postalInput.dispatchEvent(new Event('input', { bubbles: true }));
                postalInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (postalInput && !addressObj.postalCode) {
                console.warn('[Place Selection] ⚠ Postal code not found in address components');
            }
            
            // Populate province/state field
            const provinceSelect = document.getElementById('province');
            if (provinceSelect && addressObj.administrativeArea) {
                const provinceValue = addressObj.administrativeArea;
                if (provinceSelect.tagName === 'SELECT') {
                    // Try to find matching option
                    const options = Array.from(provinceSelect.options);
                    const matchingOption = options.find(opt => 
                        opt.value === provinceValue || 
                        opt.text === provinceValue ||
                        opt.value === provinceValue.toUpperCase() ||
                        opt.text.toUpperCase() === provinceValue.toUpperCase()
                    );
                    if (matchingOption) {
                        provinceSelect.value = matchingOption.value;
                        console.log('[Place Selection] ✓ Matched province option:', matchingOption.value);
                    } else {
                        // If no match, enable the select and set value
                        provinceSelect.disabled = false;
                        provinceSelect.value = provinceValue;
                        console.log('[Place Selection] ✓ Set province value directly:', provinceValue);
                    }
                } else {
                    provinceSelect.value = provinceValue;
                }
                // Trigger change event to ensure form validation
                provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // Also update country if available (only if it's US or CA)
            const countrySelect = document.getElementById('shippingCountry');
            if (countrySelect && addressObj.country) {
                const countryCode = (addressObj.country.code || addressObj.country).toUpperCase();
                // Only set if it's US or CA
                if (countryCode === 'US' || countryCode === 'CA') {
                    countrySelect.value = countryCode;
                    updateStateDropdown(countryCode);
                    console.log('[Place Selection] ✓ Set country:', countryCode);
                    // Trigger change event
                    countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            
            // Immediately check form completion after fields are populated
            setTimeout(() => {
                if (typeof window.checkFormCompletion === 'function') {
                    console.log('[Place Selection] Calling checkFormCompletion after field population');
                    window.checkFormCompletion();
                }
            }, 200);
            
            // Trigger shipping calculation and update checkout button if all fields are filled
            setTimeout(async () => {
                const address1Val = getShippingAddress1Value();
                const cityVal = document.getElementById('city')?.value?.trim();
                const provinceVal = document.getElementById('province')?.value?.trim();
                const postalVal = document.getElementById('postal')?.value?.trim();
                const countryVal = document.getElementById('shippingCountry')?.value?.trim();
                
                console.log('[Place Selection] Field values after population:', {
                    address1: address1Val,
                    city: cityVal,
                    province: provinceVal,
                    postal: postalVal,
                    country: countryVal
                });
                
                // Only require: address1, city, state_code, country_code, zip
                if (address1Val && cityVal && provinceVal && postalVal && countryVal) {
                    console.log('[Place Selection] All required fields filled, calculating shipping...');
                    await calculateShipping(true);
                    await updateCartDisplay();
                    
                    // Call checkFormCompletion to update button state after shipping is calculated
                    setTimeout(() => {
                        if (typeof window.checkFormCompletion === 'function') {
                            console.log('[Place Selection] Calling checkFormCompletion after shipping calculation');
                            window.checkFormCompletion();
                        }
                    }, 500);
                } else {
                    console.warn('[Place Selection] Not all required fields filled, cannot calculate shipping');
                    // Even if not all fields are filled, check form completion to update button state
                    if (typeof window.checkFormCompletion === 'function') {
                        window.checkFormCompletion();
                    }
                }
            }, 800);
        };
        
        // Attach the event listener (use window.handlePlaceSelection since it's now global)
        addressInput.addEventListener('gmp-placeautocomplete-placeupdated', window.handlePlaceSelection);
        console.log('[initGoogle] ✓ Attached gmp-placeautocomplete-placeupdated event listener');
        
        // Also try alternative event names in case the API uses a different name
        addressInput.addEventListener('place_changed', window.handlePlaceSelection);
        addressInput.addEventListener('placechange', window.handlePlaceSelection);
        
        // FALLBACK: Poll for place selection when input value changes significantly
        // This handles cases where the event doesn't fire
        let lastAddressValue = '';
        let placeCheckTimeout = null;
        
        const checkForPlaceSelection = () => {
            const currentValue = getShippingAddress1Value();
            
            // If value changed significantly (user likely selected from suggestions)
            // Lower threshold to 5 characters to catch more selections
            if (currentValue && currentValue !== lastAddressValue && currentValue.length >= 5) {
                console.log('[Place Detection] Address value changed significantly, checking for place...');
                console.log('[Place Detection] Previous value:', lastAddressValue);
                console.log('[Place Detection] Current value:', currentValue);
                lastAddressValue = currentValue;
                
                // Clear any pending checks
                if (placeCheckTimeout) {
                    clearTimeout(placeCheckTimeout);
                }
                
                // Wait a bit for Google to update the place data
                placeCheckTimeout = setTimeout(() => {
                    console.log('[Place Detection] Attempting to get place data...');
                    
                    // Try multiple methods to get place
                    let place = null;
                    
                    // Method 1: getPlace() method
                    if (typeof addressInput.getPlace === 'function') {
                        try {
                            place = addressInput.getPlace();
                            console.log('[Place Detection] getPlace() returned:', place);
                        } catch (err) {
                            console.warn('[Place Detection] getPlace() failed:', err);
                        }
                    }
                    
                    // Method 2: Check if value is a Place object
                    if (!place && addressInput.value && typeof addressInput.value === 'object' && addressInput.value.addressComponents) {
                        place = addressInput.value;
                        console.log('[Place Detection] Found place in addressInput.value');
                    }
                    
                    // Method 3: Try accessing via shadow DOM
                    if (!place && addressInput.shadowRoot) {
                        const internalInput = addressInput.shadowRoot.querySelector('input');
                        if (internalInput && internalInput.value && typeof internalInput.value === 'object') {
                            place = internalInput.value;
                            console.log('[Place Detection] Found place in shadow DOM input value');
                        }
                    }
                    
                    if (place && place.addressComponents && (Array.isArray(place.addressComponents) ? place.addressComponents.length > 0 : Object.keys(place.addressComponents).length > 0)) {
                        console.log('[Place Detection] ✓ Found place data, triggering handler');
                        if (typeof window.handlePlaceSelection === 'function') {
                            window.handlePlaceSelection({ detail: { place: place }, type: 'gmp-placeautocomplete-placeupdated' });
                        } else {
                            console.error('[Place Detection] handlePlaceSelection function not available');
                        }
                    } else {
                        console.log('[Place Detection] No valid place data found yet');
                        console.log('[Place Detection] Place object:', place);
                        if (place) {
                            console.log('[Place Detection] Place keys:', Object.keys(place));
                        }
                    }
                }, 1000); // Increased delay to give Google more time
            } else if (currentValue && currentValue !== lastAddressValue) {
                console.log('[Place Detection] Value changed but too short:', currentValue.length, 'characters');
            }
        };
        
        // Monitor address input value changes
        let addressValueObserver = null;
        const startAddressValueMonitoring = () => {
            if (addressValueObserver) {
                addressValueObserver.disconnect();
            }
            
            // Use MutationObserver to watch for value changes
            addressValueObserver = new MutationObserver(() => {
                checkForPlaceSelection();
            });
            
            // Also listen to input events
            addressInput.addEventListener('input', () => {
                setTimeout(checkForPlaceSelection, 1000);
            });
            
            // Listen to blur (when user clicks away after selecting)
            addressInput.addEventListener('blur', () => {
                setTimeout(checkForPlaceSelection, 500);
            });
        };
        
        startAddressValueMonitoring();
        
        // Also try to access shadow DOM input directly
        const tryShadowDOMAccess = () => {
            if (addressInput.shadowRoot) {
                const internalInput = addressInput.shadowRoot.querySelector('input');
                if (internalInput) {
                    console.log('[initGoogle] ✓ Found shadow DOM input, setting up listeners');
                    
                    internalInput.addEventListener('blur', () => {
                        console.log('[Shadow DOM] Blur detected, checking for place...');
                        setTimeout(checkForPlaceSelection, 500);
                    });
                    
                    internalInput.addEventListener('change', () => {
                        console.log('[Shadow DOM] Change detected, checking for place...');
                        setTimeout(checkForPlaceSelection, 500);
                    });
                }
            }
        };
        
        tryShadowDOMAccess();
        setTimeout(tryShadowDOMAccess, 1000);
        setTimeout(tryShadowDOMAccess, 3000);
        
        console.log('[initGoogle] Google Places Autocomplete initialized successfully');
        console.log('[initGoogle] Autocomplete instance stored:', window.autocompleteInstance);
    } catch (error) {
        console.error('[initGoogle] ERROR: Error initializing Google Places Autocomplete:', error);
        console.error('[initGoogle] Error name:', error.name);
        console.error('[initGoogle] Error message:', error.message);
        console.error('[initGoogle] Error stack:', error.stack);
        
        // Show user-friendly error
        if (addressInput) {
            addressInput.placeholder = 'Enter address manually (autocomplete error)';
            addressInput.style.borderColor = '#ff4444';
        }
        
        // Check for specific error types
        if (error.message && error.message.includes('API key')) {
            console.error('[initGoogle] API Key Error: Check if the Google Places API key is valid and has Places API (New) enabled');
        }
        if (error.message && error.message.includes('billing')) {
            console.error('[initGoogle] Billing Error: Google Places API requires billing to be enabled');
        }
        if (error.message && error.message.includes('custom element')) {
            console.error('[initGoogle] Custom Element Error: The gmp-place-autocomplete element may not be properly registered');
        }
    }
}

// Global callback for Google Maps API
// initGoogle is called by the Google Maps script callback
// No need for separate initialization function

// Country change handler
document.addEventListener('DOMContentLoaded', function() {
    const countrySelect = document.getElementById('shippingCountry');
    if (countrySelect) {
        countrySelect.addEventListener('change', function() {
            const country = this.value;
            updateStateDropdown(country);
            
            // Update autocomplete restrictions when country changes
            // The autocomplete is already restricted to US and CA, but we can update it
            // to focus on the selected country if needed
            console.log('Country changed to:', country);
            
            // If autocomplete is initialized, we could update restrictions
            // but since we're already restricted to US/CA, this is mainly for logging
            if (window.autocompleteInstance && (country === 'US' || country === 'CA')) {
                console.log('Autocomplete already restricted to US and CA');
            }
        });
    }
    
    // Proceed to shipping button
    const proceedToShippingBtn = document.getElementById('proceedToShippingBtn');
    if (proceedToShippingBtn) {
        proceedToShippingBtn.addEventListener('click', function() {
            const cartShipping = document.getElementById('cartShipping');
            const cartItems = document.getElementById('cartItems');
            if (cartShipping) {
                cartShipping.style.display = 'block';
                // Hide cart items when showing shipping form
                if (cartItems) {
                    cartItems.style.display = 'none';
                }
                cartShipping.scrollIntoView({ behavior: 'smooth', block: 'start' });
                this.style.display = 'none';
                
                // Re-initialize autocomplete when form becomes visible
                // Wait a bit longer to ensure the form is fully visible and rendered
                setTimeout(() => {
                    if (typeof google !== 'undefined' && google.maps) {
                        // Force re-initialization
                        const addressInput = document.getElementById('address-input');
                        if (addressInput) {
                            addressInput.dataset.autocompleteInitialized = 'false';
                            // Clear old instance reference
                            if (window.autocompleteInstance) {
                                window.autocompleteInstance = null;
                            }
                        }
                        // Initialize now that form is visible (force re-initialization)
                        initGoogle(true);
                        console.log('[proceedToShipping] Re-initialized autocomplete after form became visible');
                    } else {
                        console.error('[proceedToShipping] Google Maps script not loaded yet');
                    }
                }, 500);
            }
        });
    }
});

// Contact Modal
document.addEventListener('DOMContentLoaded', function() {
    const contactLink = document.getElementById('contactLink');
    const contactModal = document.getElementById('contactModal');
    const contactModalClose = document.getElementById('contactModalClose');
    const contactForm = document.getElementById('contactForm');
    const contactMessageStatus = document.getElementById('contactMessageStatus');
    
    if (contactLink && contactModal) {
        contactLink.addEventListener('click', function(e) {
            e.preventDefault();
            contactModal.classList.add('active');
        });
    }
    
    if (contactModalClose) {
        contactModalClose.addEventListener('click', function() {
            contactModal.classList.remove('active');
            if (contactMessageStatus) contactMessageStatus.style.display = 'none';
            if (contactForm) contactForm.reset();
        });
    }
    
    if (contactModal) {
        contactModal.addEventListener('click', function(e) {
            if (e.target === contactModal) {
                contactModal.classList.remove('active');
                if (contactMessageStatus) contactMessageStatus.style.display = 'none';
                if (contactForm) contactForm.reset();
            }
        });
    }
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'SENDING...';
            if (contactMessageStatus) contactMessageStatus.style.display = 'none';
            
            try {
                // Get Formspree endpoint from form action
                const formspreeEndpoint = contactForm.getAttribute('action');
                
                // Create FormData from form
                const formData = new FormData(contactForm);
                
                const response = await fetch(formspreeEndpoint, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    if (contactMessageStatus) {
                        contactMessageStatus.textContent = 'Thank you! Your message has been sent. We will try to get back to you within 24-48 hours.';
                        contactMessageStatus.style.color = 'var(--text-primary)';
                        contactMessageStatus.style.display = 'block';
                    }
                    contactForm.reset();
                    
                    setTimeout(() => {
                        if (contactModal) contactModal.classList.remove('active');
                        if (contactMessageStatus) contactMessageStatus.style.display = 'none';
                    }, 3000);
                } else {
                    const data = await response.json();
                    if (contactMessageStatus) {
                        contactMessageStatus.textContent = data.error || 'Failed to send message. Please try again.';
                        contactMessageStatus.style.color = '#ff4444';
                        contactMessageStatus.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('Error sending contact form:', error);
                if (contactMessageStatus) {
                    contactMessageStatus.textContent = 'Failed to send message. Please try again.';
                    contactMessageStatus.style.color = '#ff4444';
                    contactMessageStatus.style.display = 'block';
                }
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }
    
});

