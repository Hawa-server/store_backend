# Product Catalogue

The complete list of products the store sells: **6 categories and 41 products**. The seeders build the database from this file: `seeders/20260929000002-products.js` reads the tables below. Each product has one fixed size and shade (no variants) and no brand names.

- **Prices** are shown in GH₵, with the pesewas value the database stores (GH₵ × 100).
- **Stock:** Makeup Setting Spray (2) is the **low-stock** demo product; Pearl Stud Earrings (0) is the **out-of-stock** demo product. Every other product has more than the low-stock threshold (5).
- **Images** are ImageKit addresses (endpoint `https://ik.imagekit.io/ADORN`), each seeded as the product's main `ProductImage` (`sortOrder` 1, `isMain` true).
- **Categories**, in display order: Bags (`bags`), Makeup (`makeup`), Skincare (`skincare`), Jewellery (`jewellery`), Accessories (`accessories`), Perfumes (`perfumes`).

**Editing this file:** keep the table columns in the same order, write the pesewas value as exactly GH₵ × 100, and keep each row on one line. The products seeder checks every row and stops with a clear message if something doesn't add up.

## Bags (`bags`): 8 products

| Product | Price (GH₵) | Pesewas | Stock | Description | Image URL | Alt text |
|---|---:|---:|---:|---|---|---|
| Black Canvas Tote Bag | 120 | 12000 | 15 | A roomy black canvas tote with long shoulder handles. Light, sturdy and easy to fold, it's made for everyday errands, books and beach days. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-tote-bag-1.jpg` | Black canvas tote bag hanging on a wooden chair |
| Striped Mini Crossbody Bag | 180 | 18000 | 12 | A compact black-and-white striped crossbody bag with a chain strap. Just big enough for your phone, keys and lip gloss. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/striped-crossbody-bag-1.jpg` | Black and white striped mini crossbody bag with a chain strap |
| Woven Straw Bucket Bag | 160 | 16000 | 10 | A natural woven straw bucket bag with a brown leather strap. Perfect for sunny weekends and holidays. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/straw-bucket-bag-1.jpg` | Woven straw bucket bag with a brown leather strap |
| Red Crochet Handbag | 220 | 22000 | 8 | A bold red crochet handbag with a sturdy top handle. Handmade texture that adds colour to any outfit. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/red-crochet-handbag-1.jpg` | Red crochet handbag on a red background |
| Cream Top-Handle Bag | 320 | 32000 | 6 | A structured cream top-handle bag with a clean, polished shape. Dresses up work outfits and evenings out. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/cream-top-handle-bag-1.jpg` | Cream structured top-handle bag |
| Orange Rattan Handbag | 260 | 26000 | 7 | A bright orange woven rattan handbag with a top handle. A cheerful statement piece for warm days. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/orange-rattan-handbag-1.jpg` | Orange woven rattan handbag with a top handle |
| Black Leather Mini Duffle Bag | 380 | 38000 | 6 | A black leather mini duffle bag with two handles and a roomy main compartment. Classic, practical and made to last. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/black-mini-duffle-bag-1.jpg` | Black leather mini duffle bag on a lime-green background |
| Nylon Makeup Pouch Set (4 colours) | 150 | 15000 | 20 | A set of four zipped nylon makeup pouches in black, orange, pink and teal, with leather-look tabs. Keeps your makeup, toiletries and small items organised. | `https://ik.imagekit.io/ADORN/ADORN/Products/Bags/makeup-pouch.jpg` | Four nylon makeup pouches in black, orange, pink and teal |

## Makeup (`makeup`): 8 products

| Product | Price (GH₵) | Pesewas | Stock | Description | Image URL | Alt text |
|---|---:|---:|---:|---|---|---|
| 12-Piece Makeup Brush Set | 120 | 12000 | 20 | Twelve soft makeup brushes for foundation, powder, eyeshadow and more. Covers every step of your routine. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/makeup-brush-set-1.jpg` | Makeup brushes fanned out on a white background |
| Tinted Lip Balm | 35 | 3500 | 40 | A nourishing lip balm with a soft pink tint. Keeps lips smooth with a hint of colour. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/tinted-lip-balm-1.jpg` | Small pink pot of tinted lip balm |
| Neutral Eyeshadow Palette | 110 | 11000 | 18 | A palette of everyday neutral eyeshadow shades, with a brush. Easy to blend for soft day looks or deeper evening looks. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/eyeshadow-palette-1.jpg` | Neutral eyeshadow palette with a brush |
| Liquid Eyeliner Pen | 55 | 5500 | 25 | A black liquid eyeliner pen with a fine tip. Draws a precise line, from a subtle flick to a bold wing. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/liquid-eyeliner-1.jpg` | Black liquid eyeliner pen on a pink background |
| Pink Lip Gloss | 40 | 4000 | 30 | A glossy pink lip gloss with a smooth, non-sticky feel. Adds shine and a soft flush of colour. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/pink-lip-gloss-1.jpg` | Pink lip gloss with a swatch on a pink background |
| Black Volumising Mascara | 70 | 7000 | 25 | A black mascara with a full brush that lifts and volumises lashes. Builds easily without clumping. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/black-volumising-mascara-1.jpg` | Black mascara tube and wand on a pink background |
| Makeup Setting Spray | 85 | 8500 | 2 (low-stock demo) | A fine mist that helps keep your makeup fresh through warm, humid days. Spray from arm's length after your final step. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/makeup-setting-spray-1.jpg` | Amber makeup setting spray bottle on a wooden table |
| Red Liquid Lipstick | 65 | 6500 | 22 | A rich red liquid lipstick with a creamy finish. One confident shade for any occasion. | `https://ik.imagekit.io/ADORN/ADORN/Products/Makeup/red-liquid-lipstick-1.jpg` | Red liquid lipstick bottle |

## Skincare (`skincare`): 6 products

| Product | Price (GH₵) | Pesewas | Stock | Description | Image URL | Alt text |
|---|---:|---:|---:|---|---|---|
| Botanical Face Oil | 140 | 14000 | 12 | A lightweight botanical face oil that leaves skin feeling soft and nourished. Use a few drops after cleansing. | `https://ik.imagekit.io/ADORN/ADORN/Products/Skincare/face-oil-1.jpg` | Two amber dropper bottles of face oil on a small wooden stool |
| Vitamin C Serum (30 ml) | 150 | 15000 | 12 | A lightweight vitamin C serum for a brighter-looking, more even complexion. Use a few drops each morning before moisturiser. | `https://ik.imagekit.io/ADORN/ADORN/Products/Skincare/vitamin-c-serum-1.jpg` | Clear glass serum bottle with a dropper |
| Gel Facial Cleanser (150 ml) | 75 | 7500 | 20 | A gentle gel cleanser that removes dirt and makeup without leaving skin feeling tight. Suitable for daily use. | `https://ik.imagekit.io/ADORN/ADORN/Products/Skincare/gel-facial-cleanser-1.jpg` | Tube of gel facial cleanser |
| Hydrating Face Cream (50 ml) | 120 | 12000 | 15 | A rich face cream that keeps skin feeling hydrated and comfortable all day. Smooth onto clean skin morning and night. | `https://ik.imagekit.io/ADORN/ADORN/Products/Skincare/hydrating-face-cream-1.jpg` | Open jar of white face cream on a rock |
| Raw Shea Butter (250 g) | 45 | 4500 | 40 | Pure, unrefined shea butter for skin, hair and lips. A rich, natural moisturiser loved in Ghana for generations. | `https://ik.imagekit.io/ADORN/ADORN/Products/Skincare/raw-shea-butter-1.jpg` | Raw shea butter in a wooden bowl with a spatula |
| Hydrating Essence (50 ml) | 95 | 9500 | 14 | A light, watery essence that adds a boost of hydration before your moisturiser. Pat gently into clean skin. | `https://ik.imagekit.io/ADORN/ADORN/Products/Skincare/hydrating-essence-1.jpg` | Tube of hydrating essence on a pink background |

## Jewellery (`jewellery`): 8 products

| Product | Price (GH₵) | Pesewas | Stock | Description | Image URL | Alt text |
|---|---:|---:|---:|---|---|---|
| Silver Gemstone Bracelet | 95 | 9500 | 14 | A delicate silver chain bracelet set with small pink gemstones. Elegant on its own or stacked with others. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/silver-gemstone-bracelet-1.jpg` | Silver chain bracelet with small pink gemstones |
| Gold-Plated Hoop Earrings | 90 | 9000 | 18 | Chunky gold-plated hoop earrings with a polished finish. A timeless pair that goes with everything. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/gold-hoop-earrings-1.jpg` | Pair of chunky gold-plated hoop earrings |
| Silver Heart Pendant Necklace | 130 | 13000 | 12 | A silver chain necklace with a sparkling crystal heart pendant. A sweet, meaningful gift. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/heart-pendant-necklace-1.jpg` | Silver necklace with a crystal heart pendant |
| Green Drop Charm Necklace | 140 | 14000 | 10 | A fine silver chain necklace with small green drop charms. Adds a gentle touch of colour. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/green-drop-necklace-1.jpg` | Silver chain necklace with small green drop charms |
| Amethyst Beaded Bracelet | 75 | 7500 | 20 | A purple amethyst beaded bracelet on a stretch band. Easy to slip on and lovely layered. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/amethyst-bracelet-1.jpg` | Purple amethyst beaded bracelet |
| Crystal Wreath Earrings | 120 | 12000 | 9 | Sparkling crystal earrings in a wreath shape. Made for evenings, weddings and special occasions. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/crystal-wreath-earrings-1.jpg` | Crystal wreath earrings on black satin |
| Gold Flower Pendant Necklace | 150 | 15000 | 8 | A gold chain necklace with a white flower pendant. Feminine, fresh and easy to wear every day. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/flower-pendant-necklace-1.jpg` | Gold necklace with a white flower pendant |
| Pearl Stud Earrings | 110 | 11000 | 0 (out-of-stock demo) | Gold stud earrings with smooth white pearls. A classic, elegant pair for every day. | `https://ik.imagekit.io/ADORN/ADORN/Products/Jewellery/pearl-stud-earrings-1.jpg` | Gold and pearl stud earrings on a beige background |

## Accessories (`accessories`): 7 products

| Product | Price (GH₵) | Pesewas | Stock | Description | Image URL | Alt text |
|---|---:|---:|---:|---|---|---|
| Silver Pocket Mirror | 60 | 6000 | 20 | A compact silver pocket mirror that fits easily in any bag. Perfect for quick touch-ups on the go. | `https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pocket-mirror-1.jpg` | Silver compact pocket mirror |
| Slim Leather Wallet | 140 | 14000 | 10 | A slim black leather wallet with card slots and a note compartment. Fits neatly in a pocket or small bag. | `https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/slim-leather-wallet-1.jpg` | Slim black leather wallet on grey wood |
| Tortoiseshell Claw Clip | 35 | 3500 | 40 | A large tortoiseshell claw hair clip that holds thick hair securely. Quick, easy and stylish. | `https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/claw-clip-1.jpg` | Tortoiseshell claw hair clip |
| Classic Black Sunglasses | 95 | 9500 | 16 | Classic black sunglasses with a bold frame. A wardrobe essential for sunny days. | `https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/black-sunglasses-1.jpg` | Classic black sunglasses on a peach background |
| Pink Satin Hair Bow | 30 | 3000 | 30 | A soft pink satin hair bow on a clip. A sweet finishing touch for any hairstyle. | `https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/pink-hair-bow-1.jpg` | Pink satin hair bow on a pink background |
| Satin Scrunchie Set | 35 | 3500 | 35 | A set of four satin scrunchies in pink, teal, mint and lilac. Gentle on hair, with less pulling and creasing. | `https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/satin-scrunchie-set-1.jpg` | Four satin scrunchies in pink, teal, mint and lilac |
| Printed Silk Hair Scarf | 75 | 7500 | 20 | A printed silk hair scarf that can be tied in your hair, around your neck or on your bag. | `https://ik.imagekit.io/ADORN/ADORN/Products/Accessories/silk-hair-scarf-1.jpg` | Printed silk hair scarf |

## Perfumes (`perfumes`): 4 products

| Product | Price (GH₵) | Pesewas | Stock | Description | Image URL | Alt text |
|---|---:|---:|---:|---|---|---|
| Ocean Blue Eau de Parfum (50 ml) | 260 | 26000 | 10 | A fresh, aquatic fragrance with cool, clean notes. Light enough for every day. | `https://ik.imagekit.io/ADORN/ADORN/Products/Perfumes/ocean-blue-perfume-1.jpg` | Blue perfume bottle with a black cap among teal petals |
| Midnight Noir Eau de Parfum (50 ml) | 300 | 30000 | 8 | A deep, warm fragrance with rich, smoky notes. Made for evenings out. | `https://ik.imagekit.io/ADORN/ADORN/Products/Perfumes/midnight-noir-perfume-1.jpg` | Dark perfume bottle with a gold cap |
| Fresh Citrus Eau de Toilette (50 ml) | 220 | 22000 | 12 | A bright, zesty citrus fragrance that feels light and uplifting. Perfect for warm days. | `https://ik.imagekit.io/ADORN/ADORN/Products/Perfumes/citrus-eau-de-toilette-1.jpg` | Clear square perfume bottle with a black cap |
| Mini Perfume Gift Set | 180 | 18000 | 15 | A set of small fragrance bottles to try different scents. A lovely gift, or a way to find your favourite. | `https://ik.imagekit.io/ADORN/ADORN/Products/Perfumes/mini-perfume-set-1.jpg` | Small perfume bottles on a golden background |

Unused in ImageKit: `Accessories/printed-scarf-1.jpg` (the many-scarves photo).
