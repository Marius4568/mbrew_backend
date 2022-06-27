const express = require('express');

const graphql = require('graphql');
const { gql, request } = require('graphql-request');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

require('dotenv').config();

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
  //   console.log(req.body.products);
  const strapiProducts = await getStrapiProducts(req.body.products);

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
              images: [productItem.image.data.attributes.formats.thumbnail.url],
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
      success_url: `${process.env.FRONTEND_URL}success`,
      cancel_url: `${process.env.FRONTEND_URL}`,
    });
    return res.send({ url: session.url });
  } catch (err) {
    console.log(err.message);
    return res.status(500).send({ error: 'Server error. Please try again' });
  }
});

module.exports = router;
