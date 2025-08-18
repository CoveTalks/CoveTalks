window.STRIPE_CONFIG = {
  // Publishable key is safe to expose (it's meant for frontend)
  PUBLISHABLE_KEY: 'pk_live_51RrABe1Fvl67fP5VrtH3hkNvl4chaiFtlskEMSHJIw6M1tAHdcgZ21pgup7DCEajjyQFUDM1jnIE7W1KrGBDjieV002ztaIRXk',
  
  PLANS: {
    standard: {
      name: 'Standard',
      monthly: {
        price: 97,
        display: '$97/month',
        period: 'monthly'
      },
      yearly: {
        price: 997,
        display: '$997/year',
        period: 'yearly',
        savings: '2 months free'
      },
      features: [
        'Full database access',
        'Contact information',
        'Basic search filters',
        'Profile in directory',
        'Email support',
        'Speaking opportunity alerts',
        '1 on 1 coaching (one session)'
      ]
    },
    plus: {
      name: 'Plus',
      monthly: {
        price: 147,
        display: '$147/month',
        period: 'monthly'
      },
      yearly: {
        price: 1497,
        display: '$1,497/year',
        period: 'yearly',
        savings: '2.5 months free'
      },
      features: [
        'Everything in Standard',
        'Advanced search filters',
        'Priority support',
        'Booking management tools',
        'Analytics dashboard',
        'Featured profile placement',
        'Custom speaker tags',
        'One additional coaching session'
      ],
      popular: true
    },
    premium: {
      name: 'Premium',
      monthly: {
        price: 197,
        display: '$197/month',
        period: 'monthly'
      },
      yearly: {
        price: 1997,
        display: '$1,997/year',
        period: 'yearly',
        savings: '2.5 months free'
      },
      features: [
        'Everything in Plus',
        'Unlimited bookings',
        'Custom integrations',
        'Dedicated account manager',
        'White-label options',
        'API access',
        'Priority listing',
        'Phone support',
        'Premium only speaking opportunities'
      ]
    }
  },
  
  // Checkout configuration
  CHECKOUT: {
    successUrl: '/dashboard.html?subscription=success',
    cancelUrl: '/pricing.html',
    billingAddressCollection: 'auto',
    allowPromotionCodes: true
  },
  
  // Currency configuration
  CURRENCY: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US'
  }
};
