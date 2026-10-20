import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

void main() {
  runApp(const WarungPOSApp());
}

// ==========================================
// 1. MODEL DATA
// ==========================================
class Product {
  final String id;
  final String name;
  final double price;
  final String category;

  Product({
    required this.id,
    required this.name,
    required this.price,
    required this.category,
  });
}

class CartItem {
  final Product product;
  int quantity;

  CartItem({required this.product, this.quantity = 1});

  double get subtotal => product.price * quantity;
}

class Ingredient {
  final String id;
  final String name;
  final double costPerUnit;
  final String unit;

  Ingredient({required this.id, required this.name, required this.costPerUnit, required this.unit});
}

class RecipeItem {
  final Ingredient ingredient;
  final double quantityRequired;

  RecipeItem({required this.ingredient, required this.quantityRequired});

  double get itemCost => ingredient.costPerUnit * quantityRequired;
}

// ==========================================
// 2. APLIKASI UTAMA & NAVIGASI
// ==========================================
class WarungPOSApp extends StatelessWidget {
  const WarungPOSApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POS Warung Es Mambo & Jus',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const MainNavigationScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _selectedIndex = 0;

  final List<Widget> _screens = const [
    CashierScreen(),
    HppScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_selectedIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) => setState(() => _selectedIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.point_of_sale),
            label: 'Kasir POS',
          ),
          NavigationDestination(
            icon: Icon(Icons.calculate_outlined),
            label: 'HPP & Bahan',
          ),
        ],
      ),
    );
  }
}

// ==========================================
// 3. MODUL KASIR (POS SCREEN)
// ==========================================
class CashierScreen extends StatefulWidget {
  const CashierScreen({super.key});

  @override
  State<CashierScreen> createState() => _CashierScreenState();
}

class _CashierScreenState extends State<CashierScreen> {
  final currencyFormatter = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

  final List<Product> _products = [
    Product(id: '1', name: 'Es Mambo Coklat', price: 3000, category: 'Frozen'),
    Product(id: '2', name: 'Es Mambo Alpukat', price: 3500, category: 'Frozen'),
    Product(id: '3', name: 'Es Gabus Pelangi', price: 2500, category: 'Frozen'),
    Product(id: '4', name: 'Ice Cream Cup', price: 5000, category: 'Frozen'),
    Product(id: '5', name: 'Jus Alpukat Segar', price: 12000, category: 'Juice'),
    Product(id: '6', name: 'Jus Mangga Manis', price: 10000, category: 'Juice'),
  ];

  final List<CartItem> _cart = [];
  String _selectedCategory = 'All';
  String _salesChannel = 'Offline POS';

  void _addToCart(Product product) {
    setState(() {
      final index = _cart.indexWhere((item) => item.product.id == product.id);
      if (index >= 0) {
        _cart[index].quantity++;
      } else {
        _cart.add(CartItem(product: product));
      }
    });
  }

  double get _subtotal => _cart.fold(0.0, (sum, item) => sum + item.subtotal);

  double get _channelMultiplier {
    if (_salesChannel != 'Offline POS') return 1.20; // Penyesuaian komisi online 20%
    return 1.0;
  }

  double get _grandTotal => _subtotal * _channelMultiplier;

  @override
  Widget build(BuildContext context) {
    final filteredProducts = _selectedCategory == 'All'
        ? _products
        : _products.where((p) => p.category == _selectedCategory).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text('Kasir POS - $_salesChannel'),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: DropdownButton<String>(
              value: _salesChannel,
              underline: const SizedBox(),
              items: const [
                DropdownMenuItem(value: 'Offline POS', child: Text('POS Tunai (Luring)')),
                DropdownMenuItem(value: 'GrabFood', child: Text('GrabFood (+20%)')),
                DropdownMenuItem(value: 'GoFood', child: Text('GoFood (+20%)')),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _salesChannel = value);
              },
            ),
          ),
        ],
      ),
      body: Row(
        children: [
          // Sisi Kiri: Katalog Produk (Grid Tombol Besar)
          Expanded(
            flex: 3,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Row(
                    children: ['All', 'Frozen', 'Juice'].map((cat) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4.0),
                        child: ChoiceChip(
                          label: Text(cat),
                          selected: _selectedCategory == cat,
                          onSelected: (selected) => setState(() => _selectedCategory = cat),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.all(8.0),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      childAspectRatio: 1.2,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: filteredProducts.length,
                    itemBuilder: (context, index) {
                      final item = filteredProducts[index];
                      return ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue.shade50,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () => _addToCart(item),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              item.name,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              currencyFormatter.format(item.price),
                              style: TextStyle(color: Colors.green.shade800, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          // Sisi Kanan: Keranjang Kasir
          Expanded(
            flex: 2,
            child: Container(
              color: Colors.grey.shade100,
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Rincian Pesanan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const Divider(),
                  Expanded(
                    child: ListView.builder(
                      itemCount: _cart.length,
                      itemBuilder: (context, index) {
                        final item = _cart[index];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(item.product.name),
                          subtitle: Text('${currencyFormatter.format(item.product.price)} x ${item.quantity}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline, size: 20),
                                onPressed: () {
                                  setState(() {
                                    if (item.quantity > 1) {
                                      item.quantity--;
                                    } else {
                                      _cart.removeAt(index);
                                    }
                                  });
                                },
                              ),
                              Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.bold)),
                              IconButton(
                                icon: const Icon(Icons.add_circle_outline, size: 20),
                                onPressed: () => setState(() => item.quantity++),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Akhir:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      Text(currencyFormatter.format(_grandTotal), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.blue)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                      onPressed: _cart.isEmpty
                          ? null
                          : () {
                              showDialog(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: const Text('Pembayaran Berhasil'),
                                  content: Text('Transaksi sebesar ${currencyFormatter.format(_grandTotal)} berhasil diproses.'),
                                  actions: [
                                    TextButton(
                                      onPressed: () {
                                        setState(() => _cart.clear());
                                        Navigator.pop(ctx);
                                      },
                                      child: const Text('Selesai'),
                                    )
                                  ],
                                ),
                              );
                            },
                      child: const Text('PROSES BAYAR', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ==========================================
// 4. MODUL HPP & MANAJEMEN BAHAN BAKU
// ==========================================
class HppScreen extends StatelessWidget {
  const HppScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

    // Simulasi resep bahan baku
    final sugar = Ingredient(id: 'i1', name: 'Gula Pasir & Susu', costPerUnit: 25000, unit: 'kg');
    final plastic = Ingredient(id: 'i2', name: 'Plastik Mambo + Karet', costPerUnit: 150, unit: 'pcs');

    final recipe = [
      RecipeItem(ingredient: sugar, quantityRequired: 0.03), // 30 gram
      RecipeItem(ingredient: plastic, quantityRequired: 1.0),  // 1 pcs
    ];

    final double hpp = recipe.fold(0.0, (sum, item) => sum + item.itemCost);
    const double sellingPrice = 3000;
    final double profit = sellingPrice - hpp;
    final double margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0.0;

    return Scaffold(
      appBar: AppBar(title: const Text('Kalkulasi HPP & Resep Bahan')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Simulasi Produk: Es Mambo Coklat', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: recipe.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final item = recipe[index];
                  return ListTile(
                    title: Text(item.ingredient.name),
                    subtitle: Text('${item.quantityRequired} ${item.ingredient.unit} @ ${currencyFormatter.format(item.ingredient.costPerUnit)}'),
                    trailing: Text(currencyFormatter.format(item.itemCost), style: const TextStyle(fontWeight: FontWeight.w600)),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8)),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total HPP (Modal Pokok):', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text(currencyFormatter.format(hpp), style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Harga Jual:'),
                      Text(currencyFormatter.format(sellingPrice)),
                    ],
                  ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Keuntungan Bersih (Margin):', style: TextStyle(fontWeight: FontWeight.bold)),
                      Text('${currencyFormatter.format(profit)} (${margin.toStringAsFixed(1)}%)',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                    ],
                  ),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }
}