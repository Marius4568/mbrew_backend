import express from 'express';
import { gql, request } from 'graphql-request';
import fetch from 'node-fetch-commonjs';
import { config as dotenvConfig } from 'dotenv';
import stripePackage from 'stripe';

import isLoggedIn from '../../middleware/authorization.js';

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY);

dotenvConfig();

const router = express.Router();

const getStrapiProducts = (products) => {
  const productsQuery = gql`
    query {
      products(filters: { slug: { in: [${products.map(
        (el) => `"${el.slug}"`
      )}] } }) {
        data {
          attributes {
            title
            price
            slug
            image {
              data {
                attributes {
                  formats
                }
              }
            }
          }
        }
      }
    }
  `;

  return request(`${process.env.STRAPI_BACKEND_URL}`, productsQuery).then(
    (data) => data
  );
};

router.post('/create_checkout_session', async (req, res) => {
  const strapiProducts = await getStrapiProducts(req.body.products);

  const { userToken } = req.body;

  const response = await fetch(`${process.env.BASE_BACKEND_URL}user/get_data`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-type': 'application/json',
    },
  });

  const userData = await response.json();
  // Handling payment session based on whether the user is logged in or not
  if (userToken) {
    try {
      const session = await stripe.checkout.sessions.create({
        submit_type: 'pay',
        payment_method_types: ['card'],
        customer: userData.user[0].stripe_id,
        shipping_address_collection: { allowed_countries: ['US', 'GB', 'LT'] },
        allow_promotion_codes: true,
        shipping_options: [
          { shipping_rate: 'shr_1LCkCwKCQ1FhdYQfJpZEZv75' },
          { shipping_rate: 'shr_1LCkSsKCQ1FhdYQfRYFMKwXV' },
        ],
        mode: 'payment',
        line_items: strapiProducts.products.data.map((product) => {
          const productItem = req.body.products.find(
            (item) => item.slug === product.attributes.slug
          );

          return {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productItem.title,
                images: [
                  productItem.image.data[0].attributes.formats.thumbnail.url,
                ],
              },
              unit_amount: productItem.price * 100,
            },
            adjustable_quantity: {
              enabled: true,
              minimum: 1,
            },
            quantity: productItem.quantity,
          };
        }),
        success_url: `${process.env.FRONTEND_URL}success/?&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}`,
      });
      return res.send({ url: session.url });
    } catch (err) {
      console.log(err.message);
      return res.status(500).send({ error: 'Server error. Please try again' });
    }
  } else {
    try {
      const session = await stripe.checkout.sessions.create({
        submit_type: 'pay',
        payment_method_types: ['card'],
        shipping_address_collection: { allowed_countries: ['US', 'GB', 'LT'] },
        allow_promotion_codes: true,
        shipping_options: [
          { shipping_rate: 'shr_1LCkCwKCQ1FhdYQfJpZEZv75' },
          { shipping_rate: 'shr_1LCkSsKCQ1FhdYQfRYFMKwXV' },
        ],
        mode: 'payment',
        line_items: strapiProducts.products.data.map((product) => {
          const productItem = req.body.products.find(
            (item) => item.slug === product.attributes.slug
          );

          return {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productItem.title,
                images: [
                  productItem.image.data[0].attributes.formats.thumbnail.url,
                ],
              },
              unit_amount: productItem.price * 100,
            },
            adjustable_quantity: {
              enabled: true,
              minimum: 1,
            },
            quantity: productItem.quantity,
          };
        }),
        success_url: `${process.env.FRONTEND_URL}success/?&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}`,
      });
      return res.send({ url: session.url });
    } catch (err) {
      console.log(err.message);
      return res.status(500).send({ error: 'Server error. Please try again' });
    }
  }
});

const getOrderData = async (session) => {
  const order = await stripe.checkout.sessions.retrieve(session, {
    expand: ['line_items'],
  });
  return order;
};

router.get('/get_order_data', async (req, res) => {
  try {
    const orderData = await getOrderData(req.query.session_id);

    if (!orderData.id) {
      return res
        .status(500)
        .send({ error: `Sorry, we couldn't get your order.` });
    }

    return res.send({ order: orderData });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Server error. Try again later.' });
  }
});

const getPayments = async (customerId) => {
  const payments = await stripe.paymentIntents.list({
    customer: customerId,
    limit: 10,
  });
  return payments;
};

router.get('/get_payments', isLoggedIn, async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];

  try {
    const response = await fetch(
      `${process.env.BASE_BACKEND_URL}user/get_data`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-type': 'application/json',
        },
      }
    );
    const data = await response.json();

    const payments = await getPayments(data.user[0].stripe_id);

    if (!payments.url) {
      return res
        .status(500)
        .send({ error: `Sorry, we couldn't get your payments.` });
    }

    return res.send({ payments });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Server error. Try again later.' });
  }
});

export default router;
