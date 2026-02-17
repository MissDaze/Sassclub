// server.js - All-in-One Railway Server
// Serves your website AND processes Stripe payments

const express = require('express');
const path = require('path');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (your website, images, etc.)
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running! 🔥',
    stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing'
  });
});

// Create Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { product, size, price } = req.body;

    // Validate Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ 
        error: 'Stripe not configured. Add STRIPE_SECRET_KEY to Railway environment variables.' 
      });
    }

    // Product names mapping
    const productNames = {
      'karma': 'The Karma Tee',
      'buttercup': 'The Buttercup',
      'zero-dark': 'Zero Care - Dark',
      'zero-light': 'Zero Care - Light',
      'boss': 'The Boss Move'
    };

    // Get the Railway public URL
    const YOUR_DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` 
      : `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${productNames[product]} - Size ${size}`,
              description: '✨ Pre-Order - Ships March 2026',
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      success_url: `${YOUR_DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${YOUR_DOMAIN}/`,
      
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'IE'],
      },
      
      metadata: {
        product: product,
        size: size,
        order_type: 'pre-order',
        delivery_date: 'March 2026'
      },
    });

    console.log('✅ Checkout session created:', session.id);
    res.json({ id: session.id });
    
  } catch (error) {
    console.error('❌ Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for Stripe events
app.post('/api/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.log('⚠️  Webhook secret not configured');
    return res.sendStatus(200);
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log(`⚠️  Webhook signature verification failed:`, err.message);
    return res.sendStatus(400);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('🎉 Payment successful!', {
        id: session.id,
        amount: session.amount_total,
        customer: session.customer_details
      });
      break;
      
    case 'payment_intent.succeeded':
      console.log('💰 Payment intent succeeded');
      break;
      
    default:
      console.log(`ℹ️  Unhandled event type: ${event.type}`);
  }

  res.json({received: true});
});

// Catch all - serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Visit: http://localhost:${PORT}`);
  console.log('🚀 ========================================');
  console.log('');
  console.log('📋 Status:');
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configured' : '❌ Missing (add STRIPE_SECRET_KEY)'}`);
  console.log(`   Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN ? process.env.RAILWAY_PUBLIC_DOMAIN : 'localhost'}`);
  console.log('');
});

module.exports = app;
