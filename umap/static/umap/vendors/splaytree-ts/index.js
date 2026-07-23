// src/index.ts
var SplayTreeNode = class {
  key;
  left = null;
  right = null;
  constructor(key) {
    this.key = key;
  }
};
var SplayTreeSetNode = class extends SplayTreeNode {
  constructor(key) {
    super(key);
  }
};
var SplayTreeMapNode = class _SplayTreeMapNode extends SplayTreeNode {
  value;
  constructor(key, value) {
    super(key);
    this.value = value;
  }
  replaceValue(value) {
    const node = new _SplayTreeMapNode(this.key, value);
    node.left = this.left;
    node.right = this.right;
    return node;
  }
};
var SplayTree = class {
  size = 0;
  modificationCount = 0;
  splayCount = 0;
  splay(key) {
    const root = this.root;
    if (root == null) {
      this.compare(key, key);
      return -1;
    }
    let right = null;
    let newTreeRight = null;
    let left = null;
    let newTreeLeft = null;
    let current = root;
    const compare = this.compare;
    let comp;
    while (true) {
      comp = compare(current.key, key);
      if (comp > 0) {
        let currentLeft = current.left;
        if (currentLeft == null) break;
        comp = compare(currentLeft.key, key);
        if (comp > 0) {
          current.left = currentLeft.right;
          currentLeft.right = current;
          current = currentLeft;
          currentLeft = current.left;
          if (currentLeft == null) break;
        }
        if (right == null) {
          newTreeRight = current;
        } else {
          right.left = current;
        }
        right = current;
        current = currentLeft;
      } else if (comp < 0) {
        let currentRight = current.right;
        if (currentRight == null) break;
        comp = compare(currentRight.key, key);
        if (comp < 0) {
          current.right = currentRight.left;
          currentRight.left = current;
          current = currentRight;
          currentRight = current.right;
          if (currentRight == null) break;
        }
        if (left == null) {
          newTreeLeft = current;
        } else {
          left.right = current;
        }
        left = current;
        current = currentRight;
      } else {
        break;
      }
    }
    if (left != null) {
      left.right = current.left;
      current.left = newTreeLeft;
    }
    if (right != null) {
      right.left = current.right;
      current.right = newTreeRight;
    }
    if (this.root !== current) {
      this.root = current;
      this.splayCount++;
    }
    return comp;
  }
  splayMin(node) {
    let current = node;
    let nextLeft = current.left;
    while (nextLeft != null) {
      const left = nextLeft;
      current.left = left.right;
      left.right = current;
      current = left;
      nextLeft = current.left;
    }
    return current;
  }
  splayMax(node) {
    let current = node;
    let nextRight = current.right;
    while (nextRight != null) {
      const right = nextRight;
      current.right = right.left;
      right.left = current;
      current = right;
      nextRight = current.right;
    }
    return current;
  }
  _delete(key) {
    if (this.root == null) return null;
    const comp = this.splay(key);
    if (comp != 0) return null;
    let root = this.root;
    const result = root;
    const left = root.left;
    this.size--;
    if (left == null) {
      this.root = root.right;
    } else {
      const right = root.right;
      root = this.splayMax(left);
      root.right = right;
      this.root = root;
    }
    this.modificationCount++;
    return result;
  }
  addNewRoot(node, comp) {
    this.size++;
    this.modificationCount++;
    const root = this.root;
    if (root == null) {
      this.root = node;
      return;
    }
    if (comp < 0) {
      node.left = root;
      node.right = root.right;
      root.right = null;
    } else {
      node.right = root;
      node.left = root.left;
      root.left = null;
    }
    this.root = node;
  }
  _first() {
    const root = this.root;
    if (root == null) return null;
    this.root = this.splayMin(root);
    return this.root;
  }
  _last() {
    const root = this.root;
    if (root == null) return null;
    this.root = this.splayMax(root);
    return this.root;
  }
  clear() {
    this.root = null;
    this.size = 0;
    this.modificationCount++;
  }
  has(key) {
    return this.validKey(key) && this.splay(key) == 0;
  }
  defaultCompare() {
    return (a, b) => a < b ? -1 : a > b ? 1 : 0;
  }
  wrap() {
    return {
      getRoot: () => {
        return this.root;
      },
      setRoot: (root) => {
        this.root = root;
      },
      getSize: () => {
        return this.size;
      },
      getModificationCount: () => {
        return this.modificationCount;
      },
      getSplayCount: () => {
        return this.splayCount;
      },
      setSplayCount: (count) => {
        this.splayCount = count;
      },
      splay: (key) => {
        return this.splay(key);
      },
      has: (key) => {
        return this.has(key);
      }
    };
  }
};
var SplayTreeMap = class extends SplayTree {
  root = null;
  compare;
  validKey;
  constructor(compare, isValidKey) {
    super();
    this.compare = compare ?? this.defaultCompare();
    this.validKey = isValidKey ?? ((a) => a != null && a != void 0);
  }
  delete(key) {
    if (!this.validKey(key)) return false;
    return this._delete(key) != null;
  }
  forEach(f) {
    const nodes = new SplayTreeMapEntryIterableIterator(this.wrap());
    let result;
    while (result = nodes.next(), !result.done) {
      f(result.value[1], result.value[0], this);
    }
  }
  get(key) {
    if (!this.validKey(key)) return void 0;
    if (this.root != null) {
      const comp = this.splay(key);
      if (comp == 0) {
        return this.root.value;
      }
    }
    return void 0;
  }
  hasValue(value) {
    const initialSplayCount = this.splayCount;
    const visit = (node) => {
      while (node != null) {
        if (node.value == value) return true;
        if (initialSplayCount != this.splayCount) {
          throw "Concurrent modification during iteration.";
        }
        if (node.right != null && visit(node.right)) {
          return true;
        }
        node = node.left;
      }
      return false;
    };
    return visit(this.root);
  }
  set(key, value) {
    const comp = this.splay(key);
    if (comp == 0) {
      this.root = this.root.replaceValue(value);
      this.splayCount += 1;
      return this;
    }
    this.addNewRoot(new SplayTreeMapNode(key, value), comp);
    return this;
  }
  setAll(other) {
    other.forEach((value, key) => {
      this.set(key, value);
    });
  }
  setIfAbsent(key, ifAbsent) {
    let comp = this.splay(key);
    if (comp == 0) {
      return this.root.value;
    }
    const modificationCount = this.modificationCount;
    const splayCount = this.splayCount;
    const value = ifAbsent();
    if (modificationCount != this.modificationCount) {
      throw "Concurrent modification during iteration.";
    }
    if (splayCount != this.splayCount) {
      comp = this.splay(key);
    }
    this.addNewRoot(new SplayTreeMapNode(key, value), comp);
    return value;
  }
  isEmpty() {
    return this.root == null;
  }
  isNotEmpty() {
    return !this.isEmpty();
  }
  firstKey() {
    if (this.root == null) return null;
    return this._first().key;
  }
  lastKey() {
    if (this.root == null) return null;
    return this._last().key;
  }
  lastKeyBefore(key) {
    if (key == null) throw "Invalid arguments(s)";
    if (this.root == null) return null;
    const comp = this.splay(key);
    if (comp < 0) return this.root.key;
    let node = this.root.left;
    if (node == null) return null;
    let nodeRight = node.right;
    while (nodeRight != null) {
      node = nodeRight;
      nodeRight = node.right;
    }
    return node.key;
  }
  firstKeyAfter(key) {
    if (key == null) throw "Invalid arguments(s)";
    if (this.root == null) return null;
    const comp = this.splay(key);
    if (comp > 0) return this.root.key;
    let node = this.root.right;
    if (node == null) return null;
    let nodeLeft = node.left;
    while (nodeLeft != null) {
      node = nodeLeft;
      nodeLeft = node.left;
    }
    return node.key;
  }
  update(key, update, ifAbsent) {
    let comp = this.splay(key);
    if (comp == 0) {
      const modificationCount = this.modificationCount;
      const splayCount = this.splayCount;
      const newValue = update(this.root.value);
      if (modificationCount != this.modificationCount) {
        throw "Concurrent modification during iteration.";
      }
      if (splayCount != this.splayCount) {
        this.splay(key);
      }
      this.root = this.root.replaceValue(newValue);
      this.splayCount += 1;
      return newValue;
    }
    if (ifAbsent != null) {
      const modificationCount = this.modificationCount;
      const splayCount = this.splayCount;
      const newValue = ifAbsent();
      if (modificationCount != this.modificationCount) {
        throw "Concurrent modification during iteration.";
      }
      if (splayCount != this.splayCount) {
        comp = this.splay(key);
      }
      this.addNewRoot(new SplayTreeMapNode(key, newValue), comp);
      return newValue;
    }
    throw "Invalid argument (key): Key not in map.";
  }
  updateAll(update) {
    const root = this.root;
    if (root == null) return;
    const iterator = new SplayTreeMapEntryIterableIterator(this.wrap());
    let node;
    while (node = iterator.next(), !node.done) {
      const newValue = update(...node.value);
      iterator.replaceValue(newValue);
    }
  }
  keys() {
    return new SplayTreeKeyIterableIterator(this.wrap());
  }
  values() {
    return new SplayTreeValueIterableIterator(this.wrap());
  }
  entries() {
    return this[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return new SplayTreeMapEntryIterableIterator(this.wrap());
  }
  [Symbol.toStringTag] = "[object Map]";
};
var SplayTreeSet = class _SplayTreeSet extends SplayTree {
  root = null;
  compare;
  validKey;
  constructor(compare, isValidKey) {
    super();
    this.compare = compare ?? this.defaultCompare();
    this.validKey = isValidKey ?? ((v) => v != null && v != void 0);
  }
  delete(element) {
    if (!this.validKey(element)) return false;
    return this._delete(element) != null;
  }
  deleteAll(elements) {
    for (const element of elements) {
      this.delete(element);
    }
  }
  forEach(f) {
    const nodes = this[Symbol.iterator]();
    let result;
    while (result = nodes.next(), !result.done) {
      f(result.value, result.value, this);
    }
  }
  add(element) {
    const compare = this.splay(element);
    if (compare != 0) this.addNewRoot(new SplayTreeSetNode(element), compare);
    return this;
  }
  addAndReturn(element) {
    const compare = this.splay(element);
    if (compare != 0) this.addNewRoot(new SplayTreeSetNode(element), compare);
    return this.root.key;
  }
  addAll(elements) {
    for (const element of elements) {
      this.add(element);
    }
  }
  isEmpty() {
    return this.root == null;
  }
  isNotEmpty() {
    return this.root != null;
  }
  single() {
    if (this.size == 0) throw "Bad state: No element";
    if (this.size > 1) throw "Bad state: Too many element";
    return this.root.key;
  }
  first() {
    if (this.size == 0) throw "Bad state: No element";
    return this._first().key;
  }
  last() {
    if (this.size == 0) throw "Bad state: No element";
    return this._last().key;
  }
  lastBefore(element) {
    if (element == null) throw "Invalid arguments(s)";
    if (this.root == null) return null;
    const comp = this.splay(element);
    if (comp < 0) return this.root.key;
    let node = this.root.left;
    if (node == null) return null;
    let nodeRight = node.right;
    while (nodeRight != null) {
      node = nodeRight;
      nodeRight = node.right;
    }
    return node.key;
  }
  firstAfter(element) {
    if (element == null) throw "Invalid arguments(s)";
    if (this.root == null) return null;
    const comp = this.splay(element);
    if (comp > 0) return this.root.key;
    let node = this.root.right;
    if (node == null) return null;
    let nodeLeft = node.left;
    while (nodeLeft != null) {
      node = nodeLeft;
      nodeLeft = node.left;
    }
    return node.key;
  }
  retainAll(elements) {
    const retainSet = new _SplayTreeSet(this.compare, this.validKey);
    const modificationCount = this.modificationCount;
    for (const object of elements) {
      if (modificationCount != this.modificationCount) {
        throw "Concurrent modification during iteration.";
      }
      if (this.validKey(object) && this.splay(object) == 0) {
        retainSet.add(this.root.key);
      }
    }
    if (retainSet.size != this.size) {
      this.root = retainSet.root;
      this.size = retainSet.size;
      this.modificationCount++;
    }
  }
  lookup(object) {
    if (!this.validKey(object)) return null;
    const comp = this.splay(object);
    if (comp != 0) return null;
    return this.root.key;
  }
  intersection(other) {
    const result = new _SplayTreeSet(this.compare, this.validKey);
    for (const element of this) {
      if (other.has(element)) result.add(element);
    }
    return result;
  }
  difference(other) {
    const result = new _SplayTreeSet(this.compare, this.validKey);
    for (const element of this) {
      if (!other.has(element)) result.add(element);
    }
    return result;
  }
  union(other) {
    const u = this.clone();
    u.addAll(other);
    return u;
  }
  clone() {
    const set = new _SplayTreeSet(this.compare, this.validKey);
    set.size = this.size;
    set.root = this.copyNode(this.root);
    return set;
  }
  copyNode(node) {
    if (node == null) return null;
    function copyChildren(node2, dest) {
      let left;
      let right;
      do {
        left = node2.left;
        right = node2.right;
        if (left != null) {
          const newLeft = new SplayTreeSetNode(left.key);
          dest.left = newLeft;
          copyChildren(left, newLeft);
        }
        if (right != null) {
          const newRight = new SplayTreeSetNode(right.key);
          dest.right = newRight;
          node2 = right;
          dest = newRight;
        }
      } while (right != null);
    }
    const result = new SplayTreeSetNode(node.key);
    copyChildren(node, result);
    return result;
  }
  toSet() {
    return this.clone();
  }
  entries() {
    return new SplayTreeSetEntryIterableIterator(this.wrap());
  }
  keys() {
    return this[Symbol.iterator]();
  }
  values() {
    return this[Symbol.iterator]();
  }
  [Symbol.iterator]() {
    return new SplayTreeKeyIterableIterator(this.wrap());
  }
  [Symbol.toStringTag] = "[object Set]";
};
var SplayTreeIterableIterator = class {
  tree;
  path = new Array();
  modificationCount = null;
  splayCount;
  constructor(tree) {
    this.tree = tree;
    this.splayCount = tree.getSplayCount();
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    if (this.moveNext()) return { done: false, value: this.current() };
    return { done: true, value: null };
  }
  current() {
    if (!this.path.length) return null;
    const node = this.path[this.path.length - 1];
    return this.getValue(node);
  }
  rebuildPath(key) {
    this.path.splice(0, this.path.length);
    this.tree.splay(key);
    this.path.push(this.tree.getRoot());
    this.splayCount = this.tree.getSplayCount();
  }
  findLeftMostDescendent(node) {
    while (node != null) {
      this.path.push(node);
      node = node.left;
    }
  }
  moveNext() {
    if (this.modificationCount != this.tree.getModificationCount()) {
      if (this.modificationCount == null) {
        this.modificationCount = this.tree.getModificationCount();
        let node2 = this.tree.getRoot();
        while (node2 != null) {
          this.path.push(node2);
          node2 = node2.left;
        }
        return this.path.length > 0;
      }
      throw "Concurrent modification during iteration.";
    }
    if (!this.path.length) return false;
    if (this.splayCount != this.tree.getSplayCount()) {
      this.rebuildPath(this.path[this.path.length - 1].key);
    }
    let node = this.path[this.path.length - 1];
    let next = node.right;
    if (next != null) {
      while (next != null) {
        this.path.push(next);
        next = next.left;
      }
      return true;
    }
    this.path.pop();
    while (this.path.length && this.path[this.path.length - 1].right === node) {
      node = this.path.pop();
    }
    return this.path.length > 0;
  }
};
var SplayTreeKeyIterableIterator = class extends SplayTreeIterableIterator {
  getValue(node) {
    return node.key;
  }
};
var SplayTreeSetEntryIterableIterator = class extends SplayTreeIterableIterator {
  getValue(node) {
    return [node.key, node.key];
  }
};
var SplayTreeValueIterableIterator = class extends SplayTreeIterableIterator {
  constructor(map) {
    super(map);
  }
  getValue(node) {
    return node.value;
  }
};
var SplayTreeMapEntryIterableIterator = class extends SplayTreeIterableIterator {
  constructor(map) {
    super(map);
  }
  getValue(node) {
    return [node.key, node.value];
  }
  replaceValue(value) {
    if (this.modificationCount != this.tree.getModificationCount()) {
      throw "Concurrent modification during iteration.";
    }
    if (this.splayCount != this.tree.getSplayCount()) {
      this.rebuildPath(this.path[this.path.length - 1].key);
    }
    const last = this.path.pop();
    const newLast = last.replaceValue(value);
    if (!this.path.length) {
      this.tree.setRoot(newLast);
    } else {
      const parent = this.path[this.path.length - 1];
      if (last === parent.left) {
        parent.left = newLast;
      } else {
        parent.right = newLast;
      }
    }
    this.path.push(newLast);
    const count = this.tree.getSplayCount() + 1;
    this.tree.setSplayCount(count);
    this.splayCount = count;
  }
};
export {
  SplayTreeMap,
  SplayTreeSet
};
//# sourceMappingURL=index.js.map