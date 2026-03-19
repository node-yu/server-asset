import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async validateUser(username: string, password: string): Promise<{ username: string } | null> {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new UnauthorizedException('管理员密码未配置，请在 .env 中设置 ADMIN_PASSWORD');
    }
    if (username === adminUser && password === adminPassword) {
      return { username: adminUser };
    }
    return null;
  }

  async login(username: string, password: string): Promise<{ access_token: string }> {
    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const payload = { sub: user.username };
    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }
}
