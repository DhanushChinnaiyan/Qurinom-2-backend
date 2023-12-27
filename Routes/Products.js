const express = require("express");
const router = express.Router();
const Product = require("../Model/Product");
const userAuth = require("../Controllers/Autherization");
const Category = require("../Model/Category");
const Subcategory = require("../Model/SubCategory");
const { default: mongoose } = require("mongoose");
const { User } = require("../Model/User");

// Get all products (accessible to anyone)
router.get("/products", async (req, res) => {
  try {
    const { productId } = req.query;
    const query = productId ? { _id: productId } : {};

    const products = await Product.find(query)
      .populate("category", "_id name")
      .populate("subcategory", "_id name")
      .populate("merchant", "_id name");

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

    return res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/// Add a new product (accessible to merchants only)
router.post("/products", userAuth, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { userType, userId } = req.user;

      if (userType !== "merchant") {
        return res
          .status(403)
          .json({ message: "Forbidden: Access denied for non-merchants" });
      }

      const {
        name,
        imageUrl,
        description,
        price,
        category: rawCategory,
        subcategory: rawSubcategory,
        location,
      } = req.body;

      const category = rawCategory.toLowerCase();
      const subcategory = rawSubcategory.toLowerCase();

      // Check and create category and subcategory if they don't exist
      const [categoryObj, subcategoryObj] = await Promise.all([
        Category.findOneAndUpdate(
          { name: category },
          { name: category },
          { upsert: true, new: true, session }
        ),
        Subcategory.findOneAndUpdate(
          { name: subcategory },
          { name: subcategory },
          { upsert: true, new: true, session }
        ),
      ]);

      // Create new product
      const newProduct = await new Product({
        name,
        imageUrl,
        description,
        price,
        category: categoryObj._id,
        subcategory: subcategoryObj._id,
        location,
        merchant: userId,
      }).save({ session });

      return newProduct
        ? res
            .status(201)
            .json({ message: "Product added successfully", newProduct })
        : res.status(400).json({ message: "Failed to add product" });
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
});

// Edit a product (accessible to merchants only)
router.put("/products/:productId", userAuth, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { userType, userId } = req.user;

      if (userType !== "merchant") {
        return res
          .status(403)
          .json({ message: "Forbidden: Access denied for non-merchants" });
      }

      const { productId } = req.params;
      const { name, description, price, category, subcategory, location } =
        req.body;

      const [categoryObj, subcategoryObj] = await Promise.all([
        Category.findOneAndUpdate(
          { name: category },
          { name: category },
          { upsert: true, new: true, session }
        ),
        Subcategory.findOneAndUpdate(
          { name: subcategory },
          { name: subcategory },
          { upsert: true, new: true, session }
        ),
      ]);

      const updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, merchant: userId },
        {
          name,
          description,
          price,
          category: categoryObj._id,
          subcategory: subcategoryObj._id,
          location,
        },
        { new: true, session }
      );

      return updatedProduct
        ? res
            .status(200)
            .json({ message: "Product updated successfully", updatedProduct })
        : res.status(400).json({ message: "Failed to update product" });
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    session.endSession();
  }
});

// Delete a product (accessible to merchants only)
router.delete("/products/:productId", userAuth, async (req, res) => {
  try {
    const { userType, userId } = req.user;

    if (userType !== "merchant") {
      return res
        .status(403)
        .json({ message: "Forbidden: Access denied for non-merchants" });
    }

    const { productId } = req.params;

    const deletedProduct = await Product.findOneAndDelete({
      _id: productId,
      merchant: userId,
    });

    return deletedProduct
      ? res
          .status(200)
          .json({ message: "Product deleted successfully", deletedProduct })
      : res.status(404).json({ message: "Product not found or unauthorized" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

module.exports = router;