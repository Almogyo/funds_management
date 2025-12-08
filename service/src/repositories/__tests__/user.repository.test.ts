import { DatabaseService } from '../../database/database.service';
import { UserRepository } from '../user.repository';
import fs from 'fs';
import path from 'path';

describe('UserRepository', () => {
  const testDbPath = path.join(process.cwd(), 'test-data', 'user-repo-test.db');
  let dbService: DatabaseService;
  let userRepo: UserRepository;

  beforeEach(() => {
    const dir = path.dirname(testDbPath);
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbService = new DatabaseService(testDbPath);
    userRepo = new UserRepository(dbService.getDatabase());
  });

  afterEach(() => {
    dbService.close();
    const dir = path.dirname(testDbPath);
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          const filePath = path.join(dir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(dir);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('create', () => {
    it('should create a new user', () => {
      const user = userRepo.create('testuser', 'hashedpassword');

      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.passwordHash).toBe('hashedpassword');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.lastLogin).toBeNull();
    });

    it('should throw error for duplicate username', () => {
      userRepo.create('testuser', 'hash1');

      expect(() => userRepo.create('testuser', 'hash2')).toThrow();
    });
  });

  describe('findById', () => {
    it('should find user by id', () => {
      const created = userRepo.create('testuser', 'hashedpassword');
      const found = userRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.username).toBe('testuser');
    });

    it('should return null for non-existent id', () => {
      const found = userRepo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find user by username', () => {
      userRepo.create('testuser', 'hashedpassword');
      const found = userRepo.findByUsername('testuser');

      expect(found).not.toBeNull();
      expect(found?.username).toBe('testuser');
    });

    it('should return null for non-existent username', () => {
      const found = userRepo.findByUsername('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', () => {
      const user = userRepo.create('testuser', 'hashedpassword');

      userRepo.updateLastLogin(user.id);

      const updated = userRepo.findById(user.id);
      expect(updated?.lastLogin).not.toBeNull();
      expect(updated?.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', () => {
      const user = userRepo.create('testuser', 'oldpassword');

      userRepo.updatePassword(user.id, 'newpassword');

      const updated = userRepo.findById(user.id);
      expect(updated?.passwordHash).toBe('newpassword');
    });
  });

  describe('delete', () => {
    it('should delete user', () => {
      const user = userRepo.create('testuser', 'hashedpassword');

      userRepo.delete(user.id);

      const found = userRepo.findById(user.id);
      expect(found).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all users', () => {
      userRepo.create('user1', 'hash1');
      userRepo.create('user2', 'hash2');
      userRepo.create('user3', 'hash3');

      const users = userRepo.list();

      expect(users).toHaveLength(3);
      expect(users.map((u) => u.username)).toContain('user1');
      expect(users.map((u) => u.username)).toContain('user2');
      expect(users.map((u) => u.username)).toContain('user3');
    });

    it('should return empty array when no users', () => {
      const users = userRepo.list();
      expect(users).toHaveLength(0);
    });
  });
});