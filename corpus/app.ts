import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import franc from 'franc';
import h2p from 'html2plaintext';
import XRegEx from 'xregexp';

export class App {

  private reg = XRegEx('[^\\p{L} ]', 'gim');

  private url = XRegEx('\\b(?:(?:https?|ftp|file):\\/\\/|www\\.|ftp\\.)[-A-Z0-9+&@#\\/%=~_|$?!:,.]*[A-Z0-9+&@#\\/%=~_|$]', 'img');

  private email = XRegEx('\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,6}\\b', 'img');

  private writers = new Map<string, fs.WriteStream>();

  private set = new Set<string>();

  private outputDirectory: string = '.';

  private length: number = 20;

  async run(inputFile: string, outputDirectory: string, length: string) {

    this.length = parseFloat(length);

    this.outputDirectory = outputDirectory;

    let fileStream = fs.createReadStream(inputFile);

    let lineReader = readline.createInterface({

      input: fileStream,

      crlfDelay: Infinity
    });

    let count = 0;

    console.log('Counting the lines...');

    let timer = setInterval(() => console.log(count), 1000);

    for await (const line of lineReader) {

      count++;
    }

    clearTimeout(timer);

    fileStream.close();

    console.log(`Number of lines: ${count}`);

    fileStream = fs.createReadStream(inputFile);

    lineReader = readline.createInterface({

      input: fileStream,

      crlfDelay: Infinity
    });

    let i = 0;

    timer = setInterval(() => console.log(`${((i / count) * 100).toFixed(2)} (${i}/ ${count})`), 1000);

    for await (const line of lineReader) {

      if (line != null) {

        const object = JSON.parse(line) as any;

        const id = object['YRKE_ID'];

        const ad = this.normalize(h2p(object['PLATSBESKRIVNING'] as string).replace('\r\n', ' ').replace('\n', ' ').trim());

        if (ad != null && ad.length >= this.length && id != null && id.length > 0) {

          this.write(`__label__${id} ${ad}`);
        }

        i++;
      }
    }

    clearTimeout(timer);

    this.writers.forEach((writer) => writer.close());

    console.log(`${((i / count) * 100).toFixed(2)} (${i}/ ${count})`);
  }

  write(ad: string) {

    if (!this.set.has(ad)) {

      const language = franc(ad, { minLength: this.length, whitelist: ['swe', 'eng'] });

      this.set.add(ad);

      let writer: fs.WriteStream;

      if (this.writers.has(language)) {

        writer = this.writers.get(language) as fs.WriteStream;
      }
      else {

        writer = fs.createWriteStream(path.join(this.outputDirectory, `${language}.corpus`));

        this.writers.set(language, writer);
      }

      writer.write(`${ad}\n`);
    }
  }

  normalize(input: string) {

    let output = XRegEx.replace(input, this.url, ' ', 'all');

    output = XRegEx.replace(output, this.email, ' ', 'all');

    output = output.replace(/NULL/mg, ' ').replace(/<\/s>/img, ' ').replace(/<.+?>/img, ' ').replace(/[0-9]/img, ' ');

    output = XRegEx.replace(output, this.reg, ' ', 'all').replace(/\s+/img, ' ').toLowerCase().trim();

    return output;
  }
}