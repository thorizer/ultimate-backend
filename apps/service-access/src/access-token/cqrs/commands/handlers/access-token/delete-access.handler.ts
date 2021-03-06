import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AccessTokenRepository } from '@ultimatebackend/repository';
import { RpcException } from '@nestjs/microservices';
import { DeleteAccessResponse } from '@ultimatebackend/proto-schema/access';
import { DeleteAccessCommand } from '../../';
import { NestCasbinService } from 'nestjs-casbin';
import { AccessTokenDeletedEvent } from '@ultimatebackend/core';

/**
 * @implements {ICommandHandler<DeleteAccessCommand>}
 * @classdesc CQRS command to request password change
 * @class
 */
@CommandHandler(DeleteAccessCommand)
export class DeleteAccessHandler implements ICommandHandler<DeleteAccessCommand> {
  logger = new Logger(this.constructor.name);

  /**
   * @constructor
   * @param tokenRepository
   * @param eventBus
   * @param accessEnforcer
   */
  constructor(
    private readonly tokenRepository: AccessTokenRepository,
    private readonly eventBus: EventBus,
    private readonly accessEnforcer: NestCasbinService,
  ) {

  }

  async execute(command: DeleteAccessCommand): Promise<DeleteAccessResponse> {
    this.logger.log(`Async ${command.constructor.name}...`);
    const { cmd } = command;

    try {
      const accessTokenEntity = await this.tokenRepository.findOne({
        token: cmd.id,
      });

      if (!accessTokenEntity) {
        throw new RpcException('Access token by id not found');
      }

      await this.accessEnforcer.deleteUser(accessTokenEntity.token);
      await this.accessEnforcer.deletePermissionsForUser(accessTokenEntity.token);
      await this.tokenRepository.deleteOneById(accessTokenEntity.id.toString());

      /*  Publish to the event store of our newly created access token */
      await this.eventBus.publish(new AccessTokenDeletedEvent(accessTokenEntity));

      return {
        // @ts-ignore
        accessToken: {
          ...accessTokenEntity,
        },
      };
    } catch (e) {
      throw new RpcException(e);
    }
  }
}
