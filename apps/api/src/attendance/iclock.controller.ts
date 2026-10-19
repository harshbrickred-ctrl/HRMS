import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';

type ClockQuery = {
  SN?: string;
  table?: string;
  Stamp?: string;
  INFO?: string;
  pushcommkey?: string;
};

@Controller('iclock')
export class IclockController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('cdata')
  async handshake(@Query() query: ClockQuery, @Res() res: Response) {
    const result = await this.attendance.handshake(
      query.SN ?? '',
      query.INFO,
      query.pushcommkey,
    );
    this.send(res, result);
  }

  @Get('getrequest')
  async poll(@Query() query: ClockQuery, @Res() res: Response) {
    const result = await this.attendance.poll(query.SN ?? '', query.INFO, query.pushcommkey);
    this.send(res, result);
  }

  @Post('cdata')
  async ingest(@Query() query: ClockQuery, @Req() req: Request, @Res() res: Response) {
    const body = typeof req.body === 'string' ? req.body : '';
    const result = await this.attendance.ingest(
      query.SN ?? '',
      query.table,
      query.Stamp,
      body,
      query.pushcommkey,
    );
    this.send(res, result);
  }

  @Post('devicecmd')
  async command(@Query() query: ClockQuery, @Req() req: Request, @Res() res: Response) {
    const body = typeof req.body === 'string' ? req.body : '';
    const result = await this.attendance.commandResult(
      query.SN ?? '',
      body,
      query.pushcommkey,
    );
    this.send(res, result);
  }

  private send(res: Response, result: { body: string; dateHeader: string }) {
    res.status(200);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Date', result.dateHeader);
    res.send(result.body);
  }
}
