import { AbstractHttpAdapter } from '@nestjs/core';
import { Type } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { ExpressAdapter } from '@nestjs/platform-express';

export type Adapter = Type<AbstractHttpAdapter<any, any, any>>;

export const platforms: Adapter[] = [ExpressAdapter, FastifyAdapter];
