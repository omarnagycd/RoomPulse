//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();


const HTML="<!DOCTYPE html>\n\n<html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\"/><meta content=\"width=device-width, initial-scale=1\" name=\"viewport\"/><meta content=\"#E60000\" name=\"theme-color\"/><link rel=\"icon\" type=\"image/png\" href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAwFBMVEWKFxunGx6mHB7NU1PYICLdn59oDxmyFSp5Cw27SUkaDwP3PUDx3+B+AQCqVVX/f398HSD/AFXJQD////8AAADPAwSuAgKTAQH8+/vOJSbnKSqxFhjtAwjqNDV+AAD/AACuAADnFhlvBgiRBwi2JyfTFRfKWFjv2dlLBwlyBgiMBwtUAADQd3aVBQbpx8b16emsBQizMjLmuLfINjc0BgbWiIj/VVW4HSHYlZU2CA2tEhThp6ddBQdzFheDCQqSFxqA2kRNAAAAQHRSTlNoqNn/9v8zBJP/Gf///wMCXgP/AQD+/v7//f78/v4DAgP+T677/f//L2qPBf/Q///R///2G/8D/f8jz/9JU1+TQD8ZOgAABF1JREFUeNqdl4lW2zoQhu0shHBpubeV5Mh7bIc4KwmBhrCU93+rzkiyLXkJ6Z1zCATr/zTzjyzLFrk0QpJv0puo/m/rYkBMUkoT+CVx4V8DIgPwPzLQARFZLDoBocxuFY7isA5gEhCRJaULErYAVlExWsZVGyAm17QDgLo8z4XUsqxceFcHjIQ+lXoDAP9JUsYoZbt0wF3XHfTg8s/QBIzIQuibHsDAlPo+XIVPfzpwMRDxSzcxJAlMsSEqAQ0QkqfXKdVi5krElRwcg3IDHr0beg0QE1MPMXVdqITbkEQxPrpxhH5FSM1EaE1dDyFyCPi/oo5QDHPo5kTCOK5lAAV4LQCoI8CwT3JSAOTWk+pyrgPi1gREEoLASzOlNlnuGNtogKjpQA2BZmLeYRwmOyYusAoQkpPndwHoTCYBZt6FONcGh0ICiwqwIlf0XAzKOv6DNBaMpVZimAhNpucD6oCG2DfKTFF2rJfw+wsA9gMImMQI64hXRgYXACjlgb4yyd8D1Lrin9XtfgYwnD/yup4xeX/0PionSkDNxP5kMtnSJgFvsYE7sMuNogQszKFbAEx4XY5BQT+dvl6ZG4rY5bQ4oH5y3waAOqYQM7W/lnfjxnRAAJ4bWpXErCJYxVPHMXo+F4DHUn+4n5mI6WzqPUUaYMF0wL3QTx48NTlYessbhM+qhIhc6wD2BmKs4geTyWNCb7UyoIiT5oGjAziO38PHWgJkQplJAB+WBWAFFmgAtsYOsIdy1kcBeGmk8FoA0AJWERgsgvlMfIqhmXSkmYJXAGDL97wSgJZNnhl7xqWEI/GPtfyfkYJPKw8cAVBX3uRs96IQxrxbaKgDZTxkHYAVSTwEsP4a4xmKf1SZvygL+2yMbZ1D3A4bgJBcI0CkrqKvmreVFj54hZMY4wKwU4CI9ATgUA6Rhg+Fcq++Z1t1cesVANVGeKZIACxYGQc5Ao0bOy/wuRff9/tsDz/yosN8mhcAtMBjjRiLpaQcKcJx1G/qp2opj4QFLQAPtMO+6oURDmB8VtxM0oI2Ai6lebGclFCEKKC6nZ+8doAoHxeQU9Pj/PoZ6ePYAegbS7iSQ/30XdvSPrl3PB5bAHuhHzqmGqb3zU21x49ZlrUAHLExjR0jcAUm1ekNAKcjzzjnXtNoBzeVeU3v4/oxHiwfXAZrmO3gUlrX5Lt3oh+YLbTABGjje9vJtmdmb0wvAXYBcFoiM7z37Vx7vBcA7xzAyB5633bczy4BoBzWfhS2vLHwrwFQvL9LjHOBDnCF3vXOyRvm6SXgedblQRcAj967vFl91QVXHWi7ivep1TG9BFhS3wpAeUvvai9dmdAHAWsrvrV3NcBHIAFGCt+UHE6GUUjOAr4TO5BhyvHNhbX3rpbBL2Id/oHoB1ryKBe9O6+XjzY4x1v24TCwU1bJqVg68Vfvo/LZ+L34Cket8iG77O5d89U3Gt1hJlF11Knd9l8BirdO+FluYE9Ik4umh/gD3gJ0a4jHnxMAAAAASUVORK5CYII=\"/><title>RoomPulse</title><style>\n*{box-sizing:border-box}body{margin:0;background:#fff;color:#252525;font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.85}main{max-width:1040px;margin:auto;padding:28px 24px 60px}header{border-top:5px solid #E60000;padding-top:24px;margin-bottom:28px}.eyebrow{font-size:13px;color:#E60000;font-weight:bold;letter-spacing:.2px}h1{font-weight:900;letter-spacing:-.8px;font-size:clamp(30px,5vw,46px);line-height:1.4;margin:10px 0}h2{font-size:24px;line-height:1.7;margin:8px 0 16px}h3{font-size:19px}p{margin:10px 0}a{color:#C90000;text-underline-offset:4px}button,.btn{font:inherit;padding:11px 20px;min-height:48px;border:1px solid #E60000;background:#E60000;color:white;border-radius:7px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center}button.secondary,.btn.secondary{color:#B90000;background:#fff}button:disabled{opacity:.45;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #252525;outline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.muted,small{color:#626262;font-size:14px}.notice{border:1px solid #ecdada;border-right:4px solid #E60000;padding:16px 18px;border-radius:6px;margin:20px 0;background:#fff8f8}.error{color:#AF0000}.card{border-top:1px solid #eadede;margin-top:30px;padding-top:28px}label{display:block;font-size:14px;font-weight:bold;margin-bottom:6px}textarea{font:inherit;line-height:1.8;min-height:150px;resize:vertical;width:100%;padding:14px;border:1px solid #c9bebe;border-radius:7px;color:#252525;background:#fff}textarea:focus-visible{outline:3px solid #252525;outline-offset:3px}.mode-buttons{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 24px}.mode-buttons button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.written-answer{padding:18px 20px;border:1px solid #eadede;border-radius:7px;background:#fffafa;white-space:pre-wrap;overflow-wrap:anywhere}.written-answer small{display:block;margin-bottom:8px;color:#A90000}input{font:inherit;padding:12px 14px;border:1px solid #c9bebe;background:#fff;border-radius:7px;width:100%;min-height:48px;color:#252525}.fields{display:grid;gap:17px;max-width:720px}.topnav{display:flex;justify-content:space-between;align-items:center;gap:12px}.topnav a{font-size:14px}.invite{display:grid;gap:24px;align-items:center}.code{font-size:clamp(38px,8vw,58px);font-weight:bold;letter-spacing:8px;line-height:1.5;color:#E60000;direction:ltr;text-align:right}.qrbox{margin:0;text-align:center}.qrbox img{width:208px;height:208px;max-width:100%;display:block;margin:auto}.qrbox figcaption{font-size:13px;color:#626262}.status{display:flex;align-items:center;gap:7px;font-size:13px;color:#626262;margin-bottom:12px}.dot{width:8px;height:8px;background:#E60000;border-radius:50%;display:inline-block}.metric{display:flex;align-items:baseline;gap:14px;margin:20px 0}.metric strong{font-size:46px;color:#E60000;line-height:1.3}.results{display:grid;gap:22px}.result-head{display:flex;justify-content:space-between;gap:14px;margin-bottom:8px}.result-head strong{white-space:nowrap;color:#C90000}.track{height:11px;background:#fff0f0;border-radius:5px;overflow:hidden}.bar{height:100%;background:#E60000;transition:width .3s}.choices{display:grid;gap:12px;margin:22px 0}.choice{width:100%;text-align:right;justify-content:flex-start;border-color:#d9cccc;color:#252525;background:#fff;padding:17px}.choice .number{display:grid;place-items:center;min-width:30px;height:30px;border-radius:5px;background:#fff0f0;color:#A90000}.choice.selected{border:2px solid #E60000;background:#fff5f5;padding:16px}.choice .answer{flex:1}.joincode{max-width:330px;font-size:26px;letter-spacing:6px;direction:ltr}.hidden{display:none!important}footer{margin-top:40px;padding-top:20px;border-top:1px solid #eadede;font-size:12px;color:#626262}.url{direction:ltr;display:block;overflow-wrap:anywhere;font-size:13px}#globalError:empty{display:none}#globalError{position:relative;padding:12px 16px;border:1px solid #E60000;border-radius:6px;background:#fff6f6;color:#A90000;margin-bottom:15px}.bank-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.bank-tabs button{font-size:14px;padding:8px 12px}.bank-list{display:grid;gap:10px;margin-bottom:20px}.bank-pick{background:#fff;color:#252525;border-color:#e6d5d5;text-align:start;justify-content:space-between;width:100%}.bank-pick span{flex:1}.bank-pick small{color:#a90000;white-space:nowrap}.bank-panel{margin:20px 0 30px;padding:20px;border:1px solid #eadede;border-radius:8px;background:#fffafa}.bank-panel summary{cursor:pointer;min-height:44px;font-weight:bold}.welcome-grid{display:grid;gap:20px}.welcome-grid>div{border:1px solid #eadede;padding:24px;border-radius:8px}.welcome-grid h2{font-size:23px}.success{font-weight:bold;color:#AE0000}#qrLink{display:inline-block}.header-intro{max-width:720px;color:#595959}@media(min-width:740px){main{padding:42px 54px 64px}.invite{grid-template-columns:1fr 250px}.welcome-grid{grid-template-columns:1fr 1fr}}@media(max-width:360px){main{padding:20px 16px}.result-head{flex-direction:column;gap:0}.code{letter-spacing:5px}.actions>*{width:100%}h2{font-size:21px}}\n\n.topnav-with-language{flex-wrap:wrap}.language-switch{display:flex;gap:4px;margin-inline-start:auto;flex-shrink:0;padding:3px;border:1px solid #eadede;border-radius:9px;background:#fff}.language-switch button{font-size:13px;font-weight:bold;min-height:40px;min-width:44px;padding:5px 10px;border-color:transparent}.language-switch button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.notice{border-right:1px solid #ecdada;border-inline-start:4px solid #E60000}.choice{text-align:start}.code{text-align:right}html[dir=\"ltr\"] .code{text-align:left}html[lang=\"en\"] body{font-family:Arial,Helvetica,sans-serif;line-height:1.65}html[lang=\"en\"] .eyebrow{letter-spacing:.5px}input[dir=\"auto\"],textarea[dir=\"auto\"]{text-align:start}.bank-tabs button[aria-pressed=\"true\"]{background:#E60000;color:white}.topnav>.eyebrow{flex:1;min-width:180px}.bank-panel{padding:18px}.bank-pick{overflow-wrap:anywhere}.fields{width:100%}@media(max-width:480px){main{padding:22px 18px 44px}.topnav>.eyebrow{flex-basis:100%;font-size:12px}.topnav>a{margin-inline-end:auto}.language-switch{margin-inline-start:0}.welcome-grid>div{padding:20px}.bank-panel{padding:14px}.bank-pick{padding:12px 10px}.bank-pick small{font-size:12px}.mode-buttons{gap:8px}.mode-buttons button{padding:9px 13px;font-size:14px}.qrbox img{width:208px;height:208px}.topnav{row-gap:9px}h1{margin-top:18px}}\n.timer-setup{max-width:720px;border:1px solid #eadede;border-radius:8px;padding:18px;margin:24px 0}.timer-setup h3{margin:0 0 8px}.timer-setup .mode-buttons{margin-bottom:10px}.timer-fields{display:flex;gap:12px;align-items:end;direction:ltr;max-width:330px}.timer-fields>div{flex:1;min-width:0}.timer-fields label{direction:inherit}.timer-fields input{text-align:center;font-variant-numeric:tabular-nums}.timer-separator{padding-bottom:10px;font-size:24px}.countdown{display:grid;grid-template-columns:1fr auto;gap:6px 18px;align-items:center;padding:16px 20px;border:1px solid #eed1d1;border-inline-start:4px solid #E60000;border-radius:8px;background:#fffafa;margin:18px 0 24px;max-width:720px}.countdown-value{font-size:34px;color:#E60000;line-height:1.2;font-variant-numeric:tabular-nums;white-space:nowrap}.countdown-label{font-weight:bold}.countdown-note{grid-column:1/-1;font-size:14px;margin:0}.countdown.urgent{border-color:#E60000;background:#fff2f2}.countdown.expired .countdown-value{color:#666}.countdown.expired{background:#fafafa;border-color:#ccc}@media(max-width:360px){.countdown{padding:14px;gap:8px}.countdown-value{font-size:28px}.timer-setup{padding:14px}}\n\n.theme-toggle{font-size:13px;min-height:44px;padding:6px 12px;gap:7px;white-space:nowrap}.theme-icon{font-size:22px;line-height:1}.topnav-with-language{gap:10px}.language-switch{margin-inline-start:auto}html[data-theme=\"dark\"] body{background:#141414;color:#f2eeee}html[data-theme=\"dark\"] a{color:#ff9292}html[data-theme=\"dark\"] .header-intro,html[data-theme=\"dark\"] .muted,html[data-theme=\"dark\"] small,html[data-theme=\"dark\"] .status,html[data-theme=\"dark\"] .qrbox figcaption,html[data-theme=\"dark\"] footer{color:#c2baba}html[data-theme=\"dark\"] .eyebrow,html[data-theme=\"dark\"] .success,html[data-theme=\"dark\"] .error,html[data-theme=\"dark\"] .result-head strong,html[data-theme=\"dark\"] .metric strong,html[data-theme=\"dark\"] .code,html[data-theme=\"dark\"] .countdown-value{color:#ff9292}html[data-theme=\"dark\"] input,html[data-theme=\"dark\"] textarea{background:#202020;border-color:#685252;color:#f2eeee}html[data-theme=\"dark\"] input::placeholder,html[data-theme=\"dark\"] textarea::placeholder{color:#bcb0b0}html[data-theme=\"dark\"] .welcome-grid>div,html[data-theme=\"dark\"] .card,html[data-theme=\"dark\"] footer,html[data-theme=\"dark\"] .timer-setup{border-color:#4f3b3b}html[data-theme=\"dark\"] .bank-panel,html[data-theme=\"dark\"] .notice,html[data-theme=\"dark\"] .written-answer,html[data-theme=\"dark\"] .countdown{background:#261c1c;border-color:#634343;border-inline-start-color:#E60000}html[data-theme=\"dark\"] .bank-pick,html[data-theme=\"dark\"] .choice{background:#202020;color:#f2eeee;border-color:#634343}html[data-theme=\"dark\"] .bank-pick small,html[data-theme=\"dark\"] .written-answer small{color:#ffaaaa}html[data-theme=\"dark\"] .choice.selected{background:#3a1b1b;border-color:#E60000}html[data-theme=\"dark\"] .choice .number,html[data-theme=\"dark\"] .track{background:#4b2525;color:#ffb0b0}html[data-theme=\"dark\"] button.secondary,html[data-theme=\"dark\"] a.btn.secondary{background:transparent;color:#ffaaaa;border-color:#b14c4c}html[data-theme=\"dark\"] .mode-buttons button[aria-pressed=\"true\"],html[data-theme=\"dark\"] .bank-tabs button[aria-pressed=\"true\"],html[data-theme=\"dark\"] .language-switch button[aria-pressed=\"true\"]{background:#E60000;color:#fff;border-color:#E60000}html[data-theme=\"dark\"] .language-switch{background:#202020;border-color:#634343}html[data-theme=\"dark\"] .language-switch button{border-color:transparent}html[data-theme=\"dark\"] #qrLink{background:white;padding:10px;border-radius:8px}html[data-theme=\"dark\"] #globalError{background:#361d1d;color:#ffc1c1}html[data-theme=\"dark\"] button:focus-visible,html[data-theme=\"dark\"] a:focus-visible,html[data-theme=\"dark\"] input:focus-visible,html[data-theme=\"dark\"] textarea:focus-visible{outline-color:#fff}html[data-theme=\"dark\"] .countdown.urgent{background:#391b1b;border-color:#E60000}html[data-theme=\"dark\"] .countdown.expired{background:#222;border-color:#666}html[data-theme=\"dark\"] .countdown.expired .countdown-value{color:#bbb}@media(max-width:480px){.topnav-with-language{gap:8px}.topnav>a{margin-inline-end:auto}.language-switch{margin-inline-start:0}.theme-toggle{padding:5px 9px;font-size:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\nhtml[dir=\"rtl\"] .fields input:placeholder-shown{text-align:right}html[dir=\"ltr\"] .fields input:placeholder-shown{text-align:left}\nselect{width:100%;padding:14px;border:1px solid #bbb;border-radius:12px;font:inherit;background:var(--surface,#fff);color:inherit}html[data-theme=\"dark\"] select{background:#202126;color:#fff}.ranking-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:start;gap:10px;padding:14px 0;border-bottom:1px solid #8884}.ranking-row small{display:block;margin-top:5px}.ranking-place{font-weight:900;color:#E60000;font-size:1.3rem}.ranking-row strong{overflow-wrap:anywhere}.ranking-points{text-align:end;white-space:nowrap;font-weight:800}\n\n.section-tabs{margin-block:16px 24px}.section-tabs button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.wheel-layout{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(280px,1.2fr);gap:32px;align-items:start}.wheel-stage{text-align:center}.wheel-stage canvas{display:block;width:100%;max-width:560px;height:auto;aspect-ratio:1;margin:0 auto 18px}.wheel-editor textarea{min-height:250px;resize:vertical;line-height:1.7}.wheel-result{margin-top:22px;padding:20px;border:2px solid #E60000;border-radius:18px;background:#fff5f5}.wheel-result p{margin:0 0 10px}.wheel-result strong{display:block;font-size:clamp(1.4rem,5vw,2.2rem);overflow-wrap:anywhere;color:#B60000}html[data-theme=\"dark\"] .wheel-result{background:#2d171b}html[data-theme=\"dark\"] .wheel-result strong{color:#ff9b9b}@media(max-width:700px){.wheel-layout{grid-template-columns:minmax(0,1fr);gap:24px}.wheel-editor textarea{min-height:180px}.wheel-stage{min-width:0}}\n/* RoomPulse: visual-only red/white glass system. No activity or data changes. */\n:root{--glass-surface:linear-gradient(140deg,#fffffff0,#ffffff85);--glass-line:#ffffffef;--glass-inset:#ffffff;--glass-shadow:0 18px 50px #7b15200c,inset 0 1px 0 #fff;--glass-ink:#30242a;--glass-muted:#6b5960;--glass-accent:#d90016;--glass-field:#ffffffb8;--glass-field-line:#d9b9c0}html{background:#fff3f4}body{min-height:100vh;color:var(--glass-ink);background:radial-gradient(ellipse at 0% 8%,#f6b2bc6b,transparent 43%),radial-gradient(ellipse at 100% 48%,#f5d5d982,transparent 42%),radial-gradient(ellipse at 8% 90%,#f1e7ec,transparent 43%),linear-gradient(145deg,#fff9fa,#f8ecef);background-attachment:fixed}main{max-width:1160px;padding-top:34px}header{border:1px solid var(--glass-line);border-top:1px solid var(--glass-line);background:var(--glass-surface);backdrop-filter:blur(26px) saturate(145%);-webkit-backdrop-filter:blur(26px) saturate(145%);padding:28px 32px;border-radius:30px;box-shadow:var(--glass-shadow);position:relative;overflow:hidden}header:before{content:\"\";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 0% 0%,#fff9,transparent 68%);z-index:0}header>*{position:relative}header h1{letter-spacing:-1.6px;font-weight:900;margin-top:22px}.header-intro{max-width:780px;color:var(--glass-muted)}.topnav-with-language{padding-bottom:16px;border-bottom:1px solid #b73a4a16}.topnav>a{font-weight:700;text-decoration:none}.language-switch{background:#ffffff61;border:1px solid var(--glass-line);border-radius:18px;box-shadow:inset 0 1px 0 var(--glass-inset);padding:4px}.language-switch button{border-radius:13px;box-shadow:none}.section-tabs{display:flex;gap:8px;width:max-content;max-width:100%;padding:6px;border:1px solid var(--glass-line);background:var(--glass-surface);backdrop-filter:blur(24px);border-radius:22px;box-shadow:var(--glass-shadow)}.section-tabs button{min-width:110px;border-radius:16px!important}.card,.welcome-grid>div,.bank-panel,.timer-setup,.countdown,.written-answer,.wheel-result{border:1px solid var(--glass-line);border-radius:26px;background:var(--glass-surface);box-shadow:var(--glass-shadow);backdrop-filter:blur(24px) saturate(130%);-webkit-backdrop-filter:blur(24px) saturate(130%)}.welcome-grid{gap:24px}.welcome-grid>div{padding:28px 30px}.welcome-grid h2{font-size:26px;letter-spacing:-.6px}.welcome-grid>div>p{color:var(--glass-muted)}.card{padding:28px 30px;margin-top:26px}.bank-panel{padding:22px}.timer-setup{padding:22px}.notice{background:#fff8f8a8;border:1px solid #e8b6bf88;border-inline-start:4px solid #e60000;border-radius:20px;color:var(--glass-muted);backdrop-filter:blur(20px)}button,.btn{border-radius:16px;border:1px solid #e60000;background:linear-gradient(145deg,#ef2234,#d90016);color:#fff;box-shadow:0 6px 16px #a71c2b16,inset 0 1px 0 #ffffff40;transition:box-shadow .2s,background .2s,border-color .2s}button:hover:not(:disabled),.btn:hover{box-shadow:0 8px 22px #a71c2b24,inset 0 1px 0 #ffffff55}button.secondary,.btn.secondary{background:linear-gradient(145deg,#ffffffe3,#ffffff61);border-color:var(--glass-line);color:#ad0015;box-shadow:0 5px 15px #78223609,inset 0 1px 0 var(--glass-inset);backdrop-filter:blur(18px)}.mode-buttons button[aria-pressed=true],.bank-tabs button[aria-pressed=true],.language-switch button[aria-pressed=true],.section-tabs button[aria-pressed=true]{background:linear-gradient(145deg,#ef2234,#d90016);border-color:#e60000;color:#fff;box-shadow:0 6px 18px #a71c2b24,inset 0 1px 0 #ffffff45}input,textarea,select{background:var(--glass-field);border:1px solid var(--glass-field-line);border-radius:16px;color:var(--glass-ink);box-shadow:inset 0 2px 4px #59344205;backdrop-filter:blur(12px)}input::placeholder,textarea::placeholder{color:#89767e}input:focus-visible,textarea:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #b50018;outline-offset:3px}.bank-pick,.choice{background:var(--glass-field);border:1px solid #f5ffffee;border-radius:18px;color:var(--glass-ink);box-shadow:0 4px 14px #5f152506,inset 0 1px 0 var(--glass-inset)}.bank-pick{padding:14px 18px}.choice{padding:18px}.choice.selected{border:2px solid #e60000;background:#fff0f4e8;padding:17px}.choice .number{border-radius:11px;background:#ffe4e9;color:#ad0015}.track{height:12px;border:1px solid #ffffff90;background:#b7233810;border-radius:12px}.bar{background:linear-gradient(90deg,#e60000,#f36273);border-radius:12px}.qrbox{background:#fff;border:1px solid #fff;border-radius:24px;padding:20px;box-shadow:0 15px 35px #5e233015}.qrbox img{background:#fff;image-rendering:auto}.qrbox figcaption{color:#66565c}html[data-theme=dark] #qrLink{padding:0;border-radius:0}.code{color:#dc0018;font-variant-numeric:tabular-nums}.ranking-row{padding:17px 12px;border-bottom:1px solid #b94b5c20;border-radius:12px}.ranking-place{color:#e60000}.metric{padding:18px 22px;border-radius:20px;background:#ffffff51;border:1px solid var(--glass-line);width:max-content;max-width:100%}.wheel-stage{border:1px solid var(--glass-line);border-radius:28px;padding:20px;background:var(--glass-surface);box-shadow:var(--glass-shadow);backdrop-filter:blur(25px)}.wheel-editor{min-width:0}.wheel-result{border:2px solid #e60000}.countdown{border-inline-start:4px solid #e60000}.countdown.urgent{background:#ffe1e8db;border-color:#e60000}.countdown.expired{background:#f6f0f3c9;border-color:#99868e}.written-answer{padding:20px 24px}.muted,small,.status,footer{color:var(--glass-muted)}footer{border-color:#b8556825;padding-inline:12px}#globalError{background:#fff0f2ed;border-radius:16px;border-color:#e60000}h2{letter-spacing:-.5px}.topnav,.fields,.bank-list,.results,.wheel-layout{min-width:0}select{appearance:auto}\nhtml[data-theme=dark]{--glass-surface:linear-gradient(140deg,#fff1f416,#f0d2da06);--glass-line:#ffe0e933;--glass-inset:#fff4f421;--glass-shadow:0 18px 50px #0002,inset 0 1px 0 #ffffff1d;--glass-ink:#f6edf0;--glass-muted:#cbb9c1;--glass-field:#fff1f40b;--glass-field-line:#d4a9b64d;background:#1b1117}html[data-theme=dark] body{background:radial-gradient(ellipse at 0% 8%,#8e15374b,transparent 43%),radial-gradient(ellipse at 100% 48%,#64374645,transparent 45%),linear-gradient(145deg,#23151c,#171319);color:var(--glass-ink)}html[data-theme=dark] header:before{background:radial-gradient(ellipse at 0% 0%,#ffeff507,transparent 68%)}html[data-theme=dark] .topnav-with-language{border-color:#ffe0e918}html[data-theme=dark] .card,html[data-theme=dark] .welcome-grid>div,html[data-theme=dark] .bank-panel,html[data-theme=dark] .timer-setup,html[data-theme=dark] .countdown,html[data-theme=dark] .written-answer,html[data-theme=dark] .wheel-result{background:var(--glass-surface);border-color:var(--glass-line)}html[data-theme=dark] .language-switch{background:#ffffff06;border-color:var(--glass-line)}html[data-theme=dark] button.secondary,html[data-theme=dark] .btn.secondary{background:linear-gradient(145deg,#fff1f413,#fff1f403);border-color:var(--glass-line);color:#ffb1c1}html[data-theme=dark] .mode-buttons button[aria-pressed=true],html[data-theme=dark] .bank-tabs button[aria-pressed=true],html[data-theme=dark] .language-switch button[aria-pressed=true]{background:linear-gradient(145deg,#ef2234,#d90016);border-color:#e60000;color:#fff}html[data-theme=dark] input,html[data-theme=dark] textarea,html[data-theme=dark] select,html[data-theme=dark] .bank-pick,html[data-theme=dark] .choice{background:var(--glass-field);border-color:var(--glass-field-line);color:var(--glass-ink)}html[data-theme=dark] select option{background:#2d1f28;color:#fff}html[data-theme=dark] input::placeholder,html[data-theme=dark] textarea::placeholder{color:#b5a2ab}html[data-theme=dark] .notice{background:#ffb7ca08;border-color:#ffb7ca35;border-inline-start-color:#e60000;color:var(--glass-muted)}html[data-theme=dark] .choice.selected{background:#ad234b35;border-color:#ff6b87}html[data-theme=dark] .choice .number{background:#ff809923;color:#ffc0cd}html[data-theme=dark] .track{background:#ff83951c}html[data-theme=dark] .metric{background:#ffffff06;border-color:var(--glass-line)}html[data-theme=dark] .countdown.urgent{background:#941b3d3b;border-color:#ef4965}html[data-theme=dark] .countdown.expired{background:#3e303a55;border-color:#9b8790}html[data-theme=dark] .ranking-row{border-color:#ffe0e91c}html[data-theme=dark] .qrbox{border-color:#fff;background:#fff}html[data-theme=dark] .qrbox figcaption{color:#66565c}html[data-theme=dark] footer{border-color:#ffe0e924}html[data-theme=dark] #globalError{background:#501a2bda;color:#ffd6e0}html[data-theme=dark] input:focus-visible,html[data-theme=dark] textarea:focus-visible,html[data-theme=dark] select:focus-visible,html[data-theme=dark] button:focus-visible,html[data-theme=dark] a:focus-visible{outline-color:#ffbbc9}\n@media(max-width:700px){main{padding:20px 16px 40px}header{padding:21px 20px;border-radius:26px}.topnav-with-language{gap:8px}header h1{font-size:38px;letter-spacing:-1.2px;margin-top:22px}.header-intro{font-size:14px;line-height:1.85}.welcome-grid>div,.card{padding:23px 20px;border-radius:25px}.bank-panel,.timer-setup{padding:17px;border-radius:21px}.welcome-grid h2{font-size:23px}.section-tabs{width:100%;justify-content:stretch}.section-tabs button{flex:1;min-width:0}.language-switch button{min-width:42px;padding:5px 8px}.theme-toggle{font-size:12px;padding:6px 9px}.topnav>a{font-size:13px}.wheel-stage{padding:15px}.wheel-layout{gap:24px}.bank-pick{padding:13px 12px}.qrbox{max-width:300px;width:100%;margin:auto}.countdown{padding:16px}.code{letter-spacing:6px}.choice{padding:16px}.choice.selected{padding:15px}.written-answer{padding:18px}.metric{padding:15px 18px}}@media(prefers-reduced-transparency:reduce){:root{--glass-surface:#fff;--glass-field:#fff}html[data-theme=dark]{--glass-surface:#2d2028;--glass-field:#30222b}}@media(prefers-reduced-motion:reduce){button,.btn,.bar{transition:none!important}}\n\n\n/* Animated red-glass section navigation */\n.section-tabs{position:relative;isolation:isolate;overflow:visible;--pill-x:6px;--pill-w:110px;--pill-h:44px;--pill-y:6px}\n.section-tabs::before{content:\"\";position:absolute;left:0;top:0;width:var(--pill-w);height:var(--pill-h);transform:translate3d(var(--pill-x),var(--pill-y),0);border-radius:17px;background:linear-gradient(135deg,#ff4357d9 0%,#ed1029ed 48%,#bd001cf5 100%);border:1px solid #ffffffb5;box-shadow:0 8px 24px #b9002938,inset 0 1px 2px #ffffffc2,inset 0 -2px 7px #88001936;backdrop-filter:blur(18px) saturate(145%);pointer-events:none;z-index:0;transition:transform .48s cubic-bezier(.22,1.1,.32,1),width .48s cubic-bezier(.22,1.1,.32,1),height .3s}\n.section-tabs button,.section-tabs button[aria-pressed=true],html[data-theme=dark] .section-tabs button,html[data-theme=dark] .section-tabs button[aria-pressed=true]{position:relative;z-index:1;background:transparent!important;border:1px solid transparent!important;box-shadow:none!important;color:var(--glass-ink);transition:color .22s ease,transform .2s ease;min-height:44px}\n.section-tabs button[aria-pressed=true],html[data-theme=dark] .section-tabs button[aria-pressed=true]{color:white;text-shadow:0 1px 4px #80001d40}\n.section-tabs button:hover{transform:translateY(-1px);background:#ffffff16!important}.section-tabs button:active{transform:scale(.97)}\n.section-tabs button:focus-visible{outline:3px solid #c30028;outline-offset:4px}\nhtml[data-theme=dark] .section-tabs::before{background:linear-gradient(135deg,#ff687ec9,#ed1833e8 45%,#b8002ee8);box-shadow:0 8px 28px #ed123135,inset 0 1px 2px #ffffffbc,inset 0 -2px 7px #8a001d40}\n@media(prefers-reduced-motion:reduce){.section-tabs::before,.section-tabs button{transition:none!important}}\n/* QUIZ MODULE */\n#quiz,#quizPlay{--qa0:#E60000;--qa1:#30242a;--qa2:#b3001b;--qa3:#7a6068;--qa4:#c4455a;--qa5:#4a3a40}\n.qglass{background:var(--glass-surface,linear-gradient(140deg,#fffffff0,#ffffff85));border:1px solid var(--glass-line,#ffffffef);border-radius:20px;box-shadow:var(--glass-shadow,0 18px 50px #7b15200c);padding:20px;margin:16px 0;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}\n.qrow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}\n.qrow.between{justify-content:space-between}\n.qitem{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;border:1px solid var(--glass-field-line,#d9b9c0);background:var(--glass-field,#ffffffb8);border-radius:14px;padding:14px 16px;margin:10px 0}\n.qitem small{display:block;color:var(--glass-muted,#6b5960)}\n.qbtn-danger{border-color:#30242a!important;color:#30242a!important;background:transparent!important}\n.qtag{display:inline-block;background:#E60000;color:#fff;border-radius:99px;padding:1px 12px;font-size:13px;font-weight:bold}\n.qtag.dark{background:#30242a}\n.qcode{font-size:clamp(40px,10vw,68px);font-weight:900;letter-spacing:8px;color:#E60000;direction:ltr;line-height:1.3}\n.qchips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}\n.qchip{border:1px solid #E60000;color:var(--glass-accent,#B90000);border-radius:99px;padding:2px 12px;font-size:14px}\n.qq{font-size:clamp(20px,3.6vw,30px);font-weight:900;line-height:1.6;margin:14px 0}\n.qans{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:14px 0}\n.qa{border-radius:16px;padding:18px;color:#fff;font-weight:bold;font-size:18px;min-height:66px;display:flex;align-items:center;gap:12px;border:3px solid transparent;text-align:start;position:relative}\n.qa.c0{background:var(--qa0)}.qa.c1{background:var(--qa1)}.qa.c2{background:var(--qa2)}.qa.c3{background:var(--qa3)}.qa.c4{background:var(--qa4)}.qa.c5{background:var(--qa5)}\n.qa.right{border-color:#1a9c4b;box-shadow:0 0 0 3px #1a9c4b55}.qa.dim{opacity:.4}\nbutton.qa{cursor:pointer;width:100%;font:inherit;font-weight:bold;font-size:18px}\nbutton.qa:disabled{opacity:.55}\nbutton.qa.picked{border-color:#fff;box-shadow:0 0 0 4px #252525}\n.qa .sym{font-size:22px;min-width:26px;text-align:center}\n.qa .cnt{margin-inline-start:auto;font-size:22px}\n.qtimer{width:68px;height:68px;border-radius:50%;border:6px solid #E60000;display:grid;place-items:center;font-size:26px;font-weight:900;color:#E60000;background:var(--glass-field,#fff);direction:ltr}\n.qbar{height:10px;border-radius:6px;background:#E6000020;overflow:hidden;margin:10px 0}.qbar>i{display:block;height:100%;background:#E60000;transition:width .3s}\n.qlb .r{display:flex;justify-content:space-between;gap:10px;background:var(--glass-field,#ffffffc0);border-radius:12px;padding:10px 16px;margin:8px 0;font-weight:bold}\n.qlb .r.me{outline:2px solid #E60000}\n.qpod{direction:ltr;display:flex;gap:12px;align-items:flex-end;justify-content:center;height:250px;margin:16px 0}\n.qpod>div{flex:1;max-width:160px;border-radius:14px 14px 0 0;text-align:center;color:#fff;font-weight:900;padding:10px 6px;overflow-wrap:anywhere}\n.qpod .p1{background:#E60000;height:100%}.qpod .p2{background:#7a6068;height:70%}.qpod .p3{background:#b3001b;height:52%}\n.qcloud{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;align-items:center;padding:20px;line-height:1.3}\n.qbub{background:var(--glass-field,#fff);border:2px solid var(--glass-field-line,#d9b9c0);border-radius:16px;padding:12px 16px;margin:8px 0;width:100%;text-align:start;font:inherit;cursor:pointer;color:inherit}\n.qbub.picked{border-color:#E60000;background:#E6000014}.qbub.right{border-color:#1a9c4b;background:#eafaf0;color:#1c1c1c}.qbub.wrong{opacity:.55}\n.qqcard{border:1px solid var(--glass-field-line,#d9b9c0);border-radius:16px;padding:16px;margin:14px 0;background:var(--glass-field,#ffffff80)}\n.qopt{display:flex;gap:8px;align-items:center;margin:8px 0}.qopt input[type=radio]{width:22px;min-height:22px;flex:none}.qopt input[type=text]{flex:1}\n.qbig{font-size:64px;line-height:1.2;text-align:center}\n.qcenter{text-align:center}\n.qok{color:#1a9c4b}.qno{color:#E60000}\n.qbadge{font-size:13px;color:var(--glass-muted,#6b5960)}\n@media(max-width:560px){.qa{font-size:17px;padding:16px}.qpod{height:200px}}\n.qhint{margin:6px 0 10px;padding:8px 14px;border-radius:14px;background:#ffffff99;border:1px solid #E6000033;color:#5a1e26;font-size:14px;text-align:start}\n#qmute[data-state=blocked]{animation:qpulse 1.6s ease-out infinite}@keyframes qpulse{0%{box-shadow:0 0 0 0 #e6000066}100%{box-shadow:0 0 0 16px #e6000000}}\n#qmute{position:fixed;bottom:16px;inset-inline-end:16px;z-index:50;width:46px;height:46px;min-height:46px;padding:0;border-radius:50%;font-size:20px;line-height:1}\n#qtoast{position:fixed;bottom:76px;inset-inline:16px;margin:auto;max-width:420px;z-index:60;display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #E60000;border-radius:16px;padding:10px 14px;box-shadow:0 8px 24px #0003;color:#1c1c1c;font-size:14px}\n#qtoast span{flex:1}#qtoast button{min-height:34px;padding:2px 12px;font-size:13px}\n.qconf{position:fixed;inset:0;pointer-events:none;z-index:70;overflow:hidden}\n.qconf i{position:absolute;top:-14px;width:9px;height:14px;border-radius:2px;border:1px solid #0001;animation:qfall linear forwards}\n@keyframes qfall{to{transform:translate(var(--dx),110vh) rotate(720deg);opacity:.9}}\n@media(prefers-reduced-motion:reduce){.qconf{display:none}}\n.qhint{border-inline-start:4px solid #E60000}\n/* ---- UI2 ---- */\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\nheader{position:sticky;top:8px;z-index:60;background:#ffffff45!important;backdrop-filter:blur(28px) saturate(140%);-webkit-backdrop-filter:blur(28px) saturate(140%);border:1px solid #ffffff9c!important;box-shadow:0 10px 30px rgba(120,10,25,.08),inset 0 1px 0 #ffffffcc!important;padding:12px 18px!important;border-radius:24px!important;transition:padding .2s}\nhtml[data-theme=dark] header{background:#2a080c4a!important;border-color:#ffe9ec30!important;box-shadow:0 10px 30px rgba(0,0,0,.3),inset 0 1px 0 #ffffff1d!important}\nheader .topnav{gap:10px;flex-wrap:wrap}header .brand{margin-inline-end:auto;display:flex;align-items:center}\nheader .lg{height:40px;width:auto;display:block}.lg-d{display:none!important}html[data-theme=dark] .lg-l{display:none!important}html[data-theme=dark] .lg-d{display:block!important}\nheader .section-tabs{margin:0!important}\n.section-tabs .tbi{width:18px;height:18px;margin-inline-end:6px;vertical-align:-3px;position:relative;z-index:1}\nheader .header-intro{margin:8px 2px 0;font-size:14px;color:var(--glass-muted,#6b5960)}\nheader.hdr-s{padding:6px 12px!important}header.hdr-s .header-intro{display:none}header.hdr-s .lg{height:30px}header.hdr-s #themeLabel{display:none}\n@media(max-width:700px){header .section-tabs{order:5;flex:1 1 100%}header .topnav{gap:8px}header{padding:10px 12px!important}header .lg{height:34px}.section-tabs .tbi{margin-inline-end:4px}}\n.qhero{aspect-ratio:3/1;border-radius:22px;border:1px solid var(--glass-line,#ffffffef);box-shadow:0 12px 32px rgba(120,10,25,.18);margin:4px 0 14px;background-size:cover}\n.qbtns{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 16px}\n.qbt{display:flex;gap:12px;align-items:center;justify-content:flex-start;border-radius:18px;padding:14px 18px;font-size:17px;min-height:60px;border:1px solid var(--glass-line,#ffffffef);font-family:inherit;cursor:pointer}\n.qbt .qbi{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;background:rgba(230,0,0,.12);color:#E60000}.qbt .qbi svg{width:20px;height:20px}\n.qbt.w{background:rgba(255,255,255,.8);color:#2b1b20}.qbt.r{background:linear-gradient(135deg,#ff3b3b,#b30000);color:#fff;border-color:transparent}.qbt.r .qbi{background:rgba(255,255,255,.25);color:#fff}\n.qbt.d{background:var(--glass-field,#ffffff80);color:var(--glass-ink,#30242a)}\nhtml[data-theme=dark] .qbt.w{background:rgba(255,255,255,.88)}\n.qtile{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#ff4d4d,#c20000);display:flex;align-items:center;justify-content:center;color:#fff;flex:none}.qtile svg{width:24px;height:24px}\n.qstats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.qsc{display:flex;gap:10px;align-items:center;background:var(--glass-field,#ffffff80);border:1px solid var(--glass-line,#ffffffef);border-radius:16px;padding:12px}.qsi{color:#E60000}.qsi svg{width:26px;height:26px}.qsc b{font-size:22px;display:block}.qsc small{color:var(--glass-muted,#6b5960)}\n@media(max-width:700px){.qbtns{grid-template-columns:1fr}.qstats{grid-template-columns:1fr 1fr}.qhero{border-radius:16px}}\n.qav{width:1.5em;height:1.5em;vertical-align:-.45em;margin-inline-end:.3em;flex:none}.qav.big{display:block;width:44px;height:44px;margin:0 auto 4px}\n.qavs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.qavpick{background:var(--glass-field,#fff8);border:2px solid transparent;border-radius:16px;padding:6px;min-height:0;cursor:pointer}.qavpick .qav{width:100%;height:auto;margin:0;vertical-align:top}.qavpick[aria-pressed=true]{border-color:#E60000;box-shadow:0 0 0 3px #e6000033}\n.qavpick{aspect-ratio:1;display:flex;align-items:center;justify-content:center;min-height:0!important;height:auto}\n@media(max-width:700px){header #themeLabel{display:none}header .theme-toggle{padding:6px 10px}}\n/* clear liquid glass v3 */\n:root{--cg-bg:linear-gradient(135deg,rgba(255,255,255,.62),rgba(255,255,255,.30) 50%,rgba(255,255,255,.48));--cg-rim:inset 0 0 0 1px rgba(255,255,255,.65),inset 2px 3px 7px rgba(255,255,255,.75),inset -3px -3px 8px rgba(255,70,95,.30),0 0 16px rgba(255,80,100,.22),0 12px 30px rgba(110,10,25,.14)}\nhtml[data-theme=dark]{--cg-bg:linear-gradient(135deg,rgba(60,14,22,.62),rgba(30,6,12,.45) 50%,rgba(55,12,20,.55));--cg-rim:inset 0 0 0 1px rgba(255,255,255,.45),inset 2px 3px 7px rgba(255,255,255,.35),inset -3px -3px 9px rgba(255,40,70,.45),0 0 18px rgba(255,50,80,.28),0 12px 30px rgba(0,0,0,.45)}\nheader,html[data-theme=dark] header,.qglass,.qbt.w,.qbt.d,.qsc{background:var(--cg-bg)!important;backdrop-filter:blur(28px) saturate(140%)!important;-webkit-backdrop-filter:blur(28px) saturate(140%)!important;border:1px solid rgba(255,255,255,.6)!important;box-shadow:var(--cg-rim)!important}\nhtml[data-theme=dark] header,html[data-theme=dark] .qglass,html[data-theme=dark] .qbt.w,html[data-theme=dark] .qbt.d,html[data-theme=dark] .qsc{border-color:rgba(255,255,255,.35)!important}\nheader .section-tabs{background:rgba(255,255,255,.28)!important;backdrop-filter:blur(8px)!important;border-color:rgba(255,255,255,.55)!important;box-shadow:inset 1px 2px 5px rgba(255,255,255,.6),inset -1px -2px 5px rgba(255,70,95,.18)!important}\nheader .header-intro{color:var(--glass-ink,#30242a)}\nhtml[data-theme=dark] header .header-intro{color:#f1dfe3}\n.qbt.w,.qbt.d{color:var(--glass-ink,#30242a)}html[data-theme=dark] .qbt.w{color:#fff}\n.qbt.r{background:linear-gradient(135deg,rgba(255,70,70,.78),rgba(190,0,20,.72))!important;backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(255,255,255,.7)!important;box-shadow:inset 2px 3px 7px rgba(255,255,255,.55),inset -3px -3px 8px rgba(110,0,10,.4),0 0 18px rgba(255,40,60,.35),0 10px 26px rgba(150,0,20,.25)!important}\n.qhero{border:1px solid rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),inset 2px 3px 8px rgba(255,255,255,.4),0 0 20px rgba(255,50,70,.3),0 12px 32px rgba(120,10,25,.2)}\n/* blurred colour field behind the page */\nbody::before{content:\"\";position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 12% 14%,rgba(255,40,70,.55),transparent 28%),radial-gradient(circle at 88% 10%,rgba(255,255,255,.95),transparent 24%),radial-gradient(circle at 70% 42%,rgba(230,0,30,.38),transparent 30%),radial-gradient(circle at 8% 62%,rgba(255,255,255,.9),transparent 26%),radial-gradient(circle at 92% 86%,rgba(255,60,90,.5),transparent 30%),radial-gradient(circle at 40% 96%,rgba(255,255,255,.8),transparent 26%)}\nhtml[data-theme=dark] body::before{background:radial-gradient(circle at 12% 14%,rgba(255,30,60,.55),transparent 28%),radial-gradient(circle at 88% 10%,rgba(120,0,15,.7),transparent 26%),radial-gradient(circle at 70% 42%,rgba(255,20,50,.38),transparent 30%),radial-gradient(circle at 8% 62%,rgba(150,0,20,.65),transparent 26%),radial-gradient(circle at 92% 86%,rgba(255,50,80,.45),transparent 30%),radial-gradient(circle at 40% 96%,rgba(90,0,10,.7),transparent 26%)}\n/* dark mode: quiet, premium. No glow on borders or text. */\nhtml[data-theme=dark]{--cg-bg:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.025) 60%);--cg-rim:inset 0 1px 0 rgba(255,255,255,.10),0 10px 30px rgba(0,0,0,.35)}\nhtml[data-theme=dark] header,html[data-theme=dark] .qglass,html[data-theme=dark] .qbt.w,html[data-theme=dark] .qbt.d,html[data-theme=dark] .qsc{border-color:rgba(255,255,255,.10)!important;box-shadow:var(--cg-rim)!important}\nhtml[data-theme=dark] header .section-tabs{background:rgba(255,255,255,.04)!important;border-color:rgba(255,255,255,.10)!important;box-shadow:none!important}\nhtml[data-theme=dark] .qbt.r{border:1px solid rgba(255,255,255,.18)!important;box-shadow:0 8px 22px rgba(0,0,0,.35)!important;background:linear-gradient(135deg,#c8142a,#8e0a1c)!important}\nhtml[data-theme=dark] .qhero{border-color:rgba(255,255,255,.12);box-shadow:0 10px 28px rgba(0,0,0,.45)}\nhtml[data-theme=dark] .card,html[data-theme=dark] .welcome-grid>div,html[data-theme=dark] .bank-panel,html[data-theme=dark] .timer-setup,html[data-theme=dark] .wheel-stage,html[data-theme=dark] .section-tabs{box-shadow:0 10px 30px rgba(0,0,0,.35)!important}\nhtml[data-theme=dark] *{text-shadow:none!important}\nhtml[data-theme=dark] body::before{opacity:.55}\n/* header: layout never changes while scrolling (no jitter) */\nheader{transition:none}header>*{transition:opacity .16s ease}\nheader.hdr-s{padding:6px 12px!important}\nheader.hdr-s .topnav{flex-wrap:nowrap!important;gap:8px}\n@media(max-width:700px){header.hdr-s .brand{display:none}header.hdr-s .section-tabs{order:0!important;flex:1 1 auto!important;min-width:0;padding:3px!important}header.hdr-s .section-tabs button{font-size:0!important;min-width:0!important;padding:8px 12px!important}header.hdr-s .section-tabs button[aria-pressed=true]{font-size:13px!important}header.hdr-s .section-tabs .tbi{margin:0}header.hdr-s .section-tabs button[aria-pressed=true] .tbi{margin-inline-end:5px}}\nhtml,body{overflow-anchor:none}\nheader.hdr-s .topnav-with-language{padding-bottom:0!important;border-bottom:0!important}\n@media(max-width:700px){header.hdr-s .section-tabs button[aria-pressed=true]{font-size:12px!important;padding:8px 10px!important}header.hdr-s .language-switch{padding:2px!important}header.hdr-s .language-switch button{padding:6px 10px!important}header.hdr-s #themeToggle,header.hdr-s .theme-toggle{padding:6px 10px!important}}\n@media(max-width:700px){header.hdr-s .section-tabs button[aria-pressed=true]{font-size:0!important;padding:8px 14px!important}header.hdr-s .section-tabs button[aria-pressed=true] svg,header.hdr-s .section-tabs button[aria-pressed=true] i{font-size:16px}}\nheader .topnav-with-language{border-bottom:0!important;padding-bottom:0!important;margin-bottom:0!important}\n\n/* header stays fixed (sticky) at full size: no shrinking */\nheader,header.hdr-s{position:sticky!important;top:8px!important}\n\n/* compact header (fixed size) + labeled music toggle */\nheader,header.hdr-s{padding:6px 12px!important;border-radius:18px!important;top:6px!important}\nheader .lg{height:26px!important}header .topnav{gap:6px!important}\nheader .section-tabs{padding:2px!important}header .section-tabs button{padding:5px 9px!important;font-size:12.5px!important;min-height:0!important}\nheader .language-switch{padding:2px!important}header .language-switch button{padding:4px 9px!important;font-size:12px!important}\nheader .theme-toggle,header #themeToggle{padding:4px 9px!important;font-size:12px!important;min-height:0!important}\nheader .section-tabs svg,header .section-tabs i{width:14px!important;height:14px!important;font-size:14px!important}\n#qmusic{position:fixed;bottom:72px;inset-inline-end:16px;z-index:50;min-height:44px;padding:0 16px;border-radius:999px;font-size:15px;font-weight:700;line-height:1;white-space:nowrap}\n\n.qlanding{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}\n.qlanding button{min-height:120px;border-radius:22px;font-size:22px;display:flex;align-items:center;justify-content:center}\n\n.qlanding button[aria-pressed=false]{background-image:none!important;background-color:rgba(255,255,255,.55);color:inherit;border:1px solid rgba(230,0,0,.3);opacity:.8}\n.qlanding button[aria-pressed=true]{background:#d40000!important;background-image:linear-gradient(180deg,#f23a3a,#b80000)!important;color:#fff!important;border:1px solid #b80000;opacity:1}\n.qlanding{margin-bottom:12px}.qlanding button{min-height:84px!important;font-size:19px!important}\n.qlanding{gap:8px!important;margin-bottom:10px}.qlanding button{min-height:48px!important;font-size:16px!important;border-radius:16px!important;transition:none!important}\nhtml[data-theme=dark] .qlanding button[aria-pressed=false]{background-color:rgba(255,255,255,.06)!important;color:#f1dfe3!important;border-color:rgba(255,255,255,.14)}\n\n#quiz,#quizPlay{padding-bottom:170px}\n.qhero{background:#0b0405 url(data:image/jpeg;base64,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) center/cover no-repeat}#contact{max-width:560px;margin:0 auto}.ctc{text-align:center;padding:30px 20px 26px;border-radius:24px;border:1px solid var(--glass-field-line,#d9b9c0);background:var(--glass-field,#ffffff80);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);margin:10px 0}\n.ctc .av{width:92px;height:92px;border-radius:50%;margin:0 auto 14px;background:#E60000;color:#fff;display:grid;place-items:center;font-size:40px;font-weight:800;box-shadow:0 10px 26px #e6000040}\n.ctc h2{margin:0 0 4px;font-size:26px}.ctc .role{margin:0 0 22px;opacity:.7;font-size:15px}\n.ctr{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;padding:14px 16px;margin:10px 0;border-radius:16px;border:1px solid var(--glass-field-line,#d9b9c0);background:#ffffff55;text-align:start}\nhtml[data-theme=dark] .ctr{background:#ffffff0d}\n.ctr svg{width:26px;height:26px;flex:none;color:#E60000}.ctr small{display:block;opacity:.65;font-size:12.5px}.ctr b{display:block;font-size:17px;direction:ltr;unicode-bidi:plaintext;word-break:break-all}\n@media(max-width:520px){.section-tabs{gap:2px!important;padding:5px!important}.section-tabs button{padding-inline:5px!important;font-size:13px!important;gap:4px!important}.section-tabs .tbi{width:15px!important;height:15px!important;flex:none!important;min-width:15px}}\nhtml[dir=rtl] .ctr b{text-align:right}.ctr:active,.ctr:hover{border-color:#E60000}</style></head><body><main><header><div class=\"topnav topnav-with-language\"><a class=\"brand\" href=\"/\" aria-label=\"RoomPulse\"><img class=\"lg lg-l\" alt=\"RoomPulse\" width=\"150\" height=\"40\" src=\"data:image/png;base64,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\"/><img class=\"lg lg-d\" alt=\"RoomPulse\" width=\"150\" height=\"40\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAABoCAMAAADo11Y+AAABIFBMVEXeoaKnJSa9aWmKFRq/Kj98ISP/AGrrvsLqwL0AAH9/AD/TYV/SfoHbgX/z4N8AAAD+/v7OAgOwAQGTAgL///9+AADmKCnpBAjPJSb/AAD///9UAACwFhjpNDX///8uAwP///9MBAT///+NBQZwBQf///9UBQb///+rAAATAQHlFhlpBQdqBQZJAgR4BQa0JSfWFRY3AwNaBAXy19XjqKf46uiIBQe3HiDamZnIZ2Y4AADsyMh8BAW1NDWUFRjmHSDLNjbQd3dyFxnGV1fmt7aNFRiySUnVhofMHSFXEhKKGBlcBQVPExRmFReWHCGYJCehCQuqVVXcpKTwPEDxQkP/f3+6V1fGSkv/VVU2BAR/Pz+ZAADmIR94Fhh4EhWSJSgk44HWAAAAYHRSTlP/7v+nBIoC//8CBP////8A/f7+/QQD/v3+AcwD/v6vMS1OkM+vbW5PAyb+jnY4y/v+Sor///+0/P//Cf/x/fT+/v+P///T///+abWuTXTJ0NYD///+Av//A2IEBf6oz64MhuLjAAASqklEQVR42u2dCX/auLbAaWfu9jYFyQ4YiG12CAkQkrZJmqbp3k7b6Sy9M2/u3Pvu9/8WT5ulI1kyEMjy3vX5dUls4YTz91klmQraWEKU9LoDFKFStiCVzS8RoWm1igeoWWrzXgAJ0ZhUq9VeaSL3BkjCgDy2gJyXBnOfgITclZVyR0CwDaSJxu2kVO69ARKiI4LxgttJKbcNpJkDwnjQI6TU7o0BCZvNZrgqkHMeVHCVjEv1bg1IMxwx/UajsIma38qDwbfNFYL6uUiDy0R4i0BGuSOHnz4lnlMWkGbGY1ry2BIQZgbJweMuk95BgtrfvGnN6/X3T75/mcjT/qBOz7K6nUeQMqZvBQhV46CLq7Vajf/FZL5L5Tn7Z3f2/SeE/hoWuqwptw8aQMrKcCtARih5M2ckgHAkQurftxH6Wy6oYwkkQr2Sx1aBRGjQ2q/mZP53jeS7sRVKZC+LGk70lx6FQxOshMb2UrYAZIQm81rVJfsZD+q4XtKMKwQMJxiTNgVC7aPksVUgIVp4eFDRRrI7+4DQj+B1SVvQXGBegByV8Xw7QJqo3fLysEJJAvKtCMmUqsvto+SxLSAhutyfV6srINnbY37rvxXJpuDCMiyDR0lmEyAsgBTy4KFkj+Fg8uCTpfAm6ykqHmEYlUg2jSGuBMuWjMfeXv2bMQqs7FZ4smYYqW9LuS6QkBnIfDmRuSKyN/sM/JY0h1BWiMmg1yUi+yrlWkAi9GZ/BR7MSBSRqy+JWZQI7bcnjwmuli2tjYDQiru1IhCIhAV3o5lCDS2DwaRbArkmkBAdrIrD9FsPBgj9G0ydGY4MSTlveG0gtMzer64hc8ljd6/+z7EuSkI0yEZg0u0NShVfP8vqrgVE+S2zKGmK+UIKY9Iupww3A/JDbT0g0m/xSvFLOwvoIWr3egdHsrQpe1obAMHrApF+SzRTvrGCexQ2/+9EjzAn6/7ykfX/xkBCNMbVa4g2EtZx5Blwk0/FOyRwyr2lFIV3aSHXBcL9FpgpWX9e6j5AGRxYMjjiAXC0MpMeJlw2XdqxORDut7K2PA3uf/QqHg3jRtygEneUDNNAQLlDGiM5zWkITUumg7FrVYdD2Kyp8Pc1nGw2V7oNIMxvZW3g74+87yEI4p28UDx9BuUOiUSo64meeDJe6YanxZd6Sfs+AAFTJfV/5JZBZAYSNHY80ugHd0nEC4Tve4lWAqIq4cPbAPLi9clZIRCskPx998nA2XQvArKzE99pCOkW5JerBIVbBjJ/zVR2UkxEI+HB/Y8uIrEfyE7nLm2kCAglMroLIMgP5D+Fys6KTYQiec7Xbz1/vtv64Ei3ioHsdO4rkOpiKZEbAkI8BnIsNHZSYB5ChJE8f76//54aSbgeEOq1gvsJhCZO4epBfVtA5CJ2h7ySCnu6BIdE8pzKfP95q23fV8uA7AzvjAgEgvH6TusmgIAurSUnmcKulgOh72afGgj9s98a5IgoIJ2UFoNpmg47G5pIYf3iOOkZr4DgRZvJYNKFWJZurLgJIJGrOmJSf5Qp7N+XwZBGsi/kvT0VooEM9TGApGHE9WW9FXnKNUK9zjzpHQ+AqENt6MAHfIdM094lI48VAAkjmaJFUb6blK08oOdCVwy58KS8SmGn2IrjwsA9SOb77w0bgWlvHyh7qImkCkhekUW3uvVNYB6G/ylOnsIQJ02q+hFbMQND6sSV+kbLgnpovyg0+wPGxZoWkKbYhuaQp0pfT7GdV2EXDyrSSFqwjWAAAZpHnTwQprS0H3fiOO4463h2aNih5xtigKlh+to+PdmAJwN+RXoojvupeUEKJB+/qUIwmIdGyWGSJEfmVtZEiAcI0zhf6IHZ7BDb2AGQsDFs5QGTbo/1aCITiDUTruVXfQM/mmlHxXhcnZ68a2GnVAWRN+A2cgOh2hraQKgCgw4oIuNhmrOIoA8yhDjVdkDPdIwCtMErnACl4KjZGHACgUcpkF72ziZqY9IhkYdIEjktJOkZ9zjuTqB1LaC+ce/IspAITbELCD4F7+1XrANHFZ+xQ8czL5E5dVoTbZk+ICi1gNC/fTsBM+5p+lVqJWxxNgAanDrJ1D80ezUwo4NAxgDIRGnhB0Rq2ljkHXygTrdRHghbgp7TJlGNrgHJtc2sGJIQJ5CWCOnCb70AQPBMnDlxOy1pIy201EKQaSHcPPIpMbinmREUdMMc/ZlGmkcMfgU3EKhxCqS6HhBPjjRhlw9Zsz5/bgqBnKPBpctlCTPYOf6F//cag8QqC/ZXuMBrzQ9AJNNZlgHEjCGmb3GkYL6eWCwHOE86EOsMwu2yQmAh3XWBhG4eohXsS2j5EraKmhLATiB/FqYhDOV4DhJdWb9TE/HIPBdFYldQB+rloSL1dYRlbuTu4msijZ3VJFa5li+GTJUaHq8JhBZ1zoDMF6nBC+f7mMplXbiA4CsZzfFTaQ0KyCv1zp75TWTOEq2wKO2FHosbgb8lHMsIM/T3J5mKVwWiGwM+CyHA06wHBCYEsPan9QzbRZMrHnSvf1SRV6chxAXkNDOCigwimbLxCShPvETm+/OBCwgIqX2jvRjknb2pwcImPr/sykA6hUCgx6KKXAbkEAKBnXPcGxy126LyJ/RHyT2yMsj3Bu0ByMVI5rKoibH8NcejJfzSKyxjSUUpe/YIZMNeILXavtqd67KQdBibXh06sE4apMYI7rRAhGmkKWvAxKaJNdTLWW/GDBspHK2iiAGkyWtyWtOBMoRiKgKCLQsJgcfCiyxpomXFgv4oEEBwT3Z1e4B8BoTn2bm+iPBLx9QgnsnS0A7phSayX9vf/84FZKchxL5joYH0syjTgJkRyMDiINd9GUIgtgGy3NkY7QKiulYwL6UQ1gQy0ff874wvN7vE6uH22PKjZjhC+udPJRBehbTyQF4rRyVtJYsX8tuz/yo2kVq11gXlXKE3aXCbiWFAEEEmMOJwA8ZwOaADmTaMC4AOc180TtJCIL/x2ru9mGLDtV8bCD6Sq4mY3iO+KUqzis5ljakMiowrsvV+iVsAiOyJPAMu6XXmvEBI/xM5LTSRKnVZP4BCpFHIA0GHpBuNRqESpK4+SwouogjwEGH0AXgbyxHJYAjOfnO7QFgTiI4v5Eit8BI1obrSIsoW5f2uDuJ2RYUQCgRbbdx3QN3i63fyFxZ4HhIRSnwmIoBE+bTXWbsF0CENYYsQpMt9ZykD2sjaQgQQACvID84BcU2FttcE0jT6YFgsOBfdQ+CxMOzpZ4kwPqjI1nsGRGuz1Zody4YJk19lachFmM4xfYVItp6eVk6ZVE5fWUBq36wEJE6tDAo0ZOldrpUcuwdoTOmOCSSwZlsAEOiyMqsQvgFmrJjP4JLs4CpAIECZTI2zvco63PcmTNiqvMlCDe/JOuSy1eJAaPp08pTKMRORSP0ZplXSFk6VuTyzVfuCmEAerwAk7ov+rQYSQ33Dux4MQI52WGcDIKZxKx5iulAAod8bQGQJINJeLJquDMjILgwx6fGmMI8uea+o7wEOpIkOOZCWjtZAzuSvKErDt9x4HqkITyrW8OOWCWTiqkPyfaXAVizUtyIZayDmAHDYB6SxFpDMUniqKoCIYwVAsAJCz06zCYqsMCQ0qTpniyQdUUoaKP1nWuHX/twSQLLS3KXgU10angH3ZZvIsemyqqq/CYHYSe8QFQPRdrHjBrJzHSDDYiD8xs7Wya0JhIUFrOeMhMJJQk1nml3Ihi+EA4nQ/7QyC8F/svSrGiOCwk/aWES4IG8Nm3r0i+mysKfbSyW1+1QrWMhyIJbLQtcEIvzMRM0buYCowRxIJodyL7Lo6BrXZBnXtIqLRMaQSw1k9u5EyU+VM+2AdCB/a5gOab06Ozt7+JD+c/bLLzPNgzCPpRds5Cp1q2tiADFDBKgt3EDSrQPBhPDsKJtsWhcIk6MeMdIkzFojvSrOpdbKIGkuXOFbnloaiFdkdJlh8hP/4j+I8etnog9xAzmCk7hGtxdWfNKf66quYUypp/p1sdX7tTr4/XWAuGKISH0mAzFXq+e9rwEkEv0SwzkNABDikoQDmawCRGa4Z2RW3MHSQLiBRMjXfjf6trEJRFRxmb5B8dHJT2fAhvymQIhvv851LKTJ3vsRmxpXRtFlj7KSP+q3JC+8uahCSDEQ8kIGEVEi/kT8IwmnzwwErvkzCjyufmPFCeuB6IKio2bRYbE91Gy0iRjFX64wBEDk9G+RyyKJZ0eberdEz1/5gGifEI7EiiKtGhOjZ13W+HIlCxGh4yk51vlvDgQwRmogVWsdkDVBZXSaOlZlKFNhowHcgAj1AE0phr0sHxBX60S9hbFn1SgYEaopvSIgkYw/zRHPuNTZRMdvY2cjf6BSkwE5VyFkCRBRGh4/lFxcQGQYkTxqPePd5YAYCxyYegJYO6bZKqrOjqt3yFfbiQG6Iz8MlgHxBHX1FpJlQGgYYL3bc2A0DEhCzPPQ6bHyXOMiLvj8JYOEW0iIXrZWIkKewnKROFno2E4dlvWYE9Bc7Kv58djqLg6NZQvW0kZr9UiHD0j70IJsl4W2AgSMwEQu2PmI3UCmgsGCTI/ELsVRpIGQQ+DpLtiOOWYdI9Hvxxd8CjdCb1YEAlYEPWoV4pD2YS9ucwBR+m3IfjkoF9lexNicEAwCY+2pNaCPgmVAPN3eJS4rAv4Jk0Vyft6GBxIYZPB0IgGJFhYL7AQMTUBEUc+5SAZdQTashCi5XBHIGZiTIst4VHtoORBzxcKweAo35j6taNKdT45cB8h0CRB6w9s3IPzWuAS79VE2nkx7B5MpDOoGW3zRmxwMJr1sBPUpFMjgSesJx/FkCRDQJXm2zF3hQdEOKgAkNRXqXVOy00iDJYscRC1zM0ASf1KJP7Ld0wNsmMyFe+gC/R6dX/hVnKDKj+gfdcqCyWxJVL9UTZIspLtKG97BeuzYveoCggyT4JPqPiKpI+64VpHchMsyciqHFulrkgtoMm3PUPqzmsCD5YTPqV/Wn6wGhLzO3spDkhUbXvMI0WpAjGUNvBZx754eaqNyrWzUA2ILSMMEEgTx+haCwoL7ms+XjKBTIyByGwrkH2U3YvHbo+FDCiR5UKcsqDwoBMKUna1sOL4kHuHm0Rs7n0rhyG/s1FdMUzniCNwSygY0XCtJA+OHZEDixvL5kKVACu7rj0jOz34EQA5dg8lClCZeIux5iBX0Yfb+yfs6l5a/9GatEPJWvpN3BThqpO15FKkbiLGWtBPICr5hqRuZW3ns5b9qrfXGQIoe1jB1K1nJgoBcaprT+cVvWZk8cp3G5OOYp70v6/VZXYrfOLhki7GeeXhQHHjifSAOtYVYTIR0UnjDB2kHHJeOfqj3FMRDe/8HX/8OB+g9O+yHCMmgp33+bT9VxWif7StpxGp5dpPeseKeK3pSSZNp3FIj6R3pF0Rs/4HMskLR6zXIjXXbgl5rYCIhZJLISv1NXYufhRBRGlb85tE9Kn78jNpr5jmuFY6CdDgc9vl2nfzeQ36NlJ0fugesuTkx4VsLiz9ZLuR7bHrd7A1PJ9azUOiX4/ZiMqF1CHfZ4wHNeMVQo5Uvr5Uc9OTpLi9dBNrK+NILJK900TZ568OBD4qfF6VvY5uGraXAWMMQuK8VOJVrb03MbVVU+w+v8ZQasdJQ9GWNnWi6vWt9QwePHVvYMjpJdjp78FClPYNAiKdNnwkt1h+98OBgue6yHai+XZyu48uepxWgDR64Zb2qqfZvLtluC/cNjsJcrAzPeaNQdaiy0a4n64FrgR2hlc91EwgpltnbB/mDDEeNDP5lnivOlL6lsbnTlZcmkGuI8FaTO3oC2/83qcCYXm9dE0f1cbLio75KWQbkciMgHAevzEscWwLyZAMgAgevzMuPALt7IAJHDbfLDwnZJhCY9dbra/AQONi0RxnMtwmktXstIJjj4JV5+fDq7QZ19kF44sl89d36mt5qUgbzrQP5blcR2d2rr4Oj2k1Q+XmeWwfyUn8W3u7eHl4Zh2cWqpRNgSTaPqi0VsXB1zCUPG4ACPqyp3ks9VkSR61b5ro3BuRDXfPYu1rNW01Q+clSNwXkr+iL5lHos7LPWC+D+Y0CGaH2bA98WKQfB3v2f7VsXN24y2qiD1d7CshXh4lcXGTPpVltFqqUjYCgH9HnK/UZeD9f+XFU/6Vmoe4OCCXyafaz5LH31SRyQfRTm2q4bFzdChD0N4T+8GzvZwbl69evs3zs0I/tKHHcBhAWFMaf//ng2dWz2Zc/tLtVrDZwVk3zKBV2O0CY20JsyQpfkjIm8pkfxuMCj8pgfptAqN8SH9UZfBui8RRXrWd1LMpc97aBIL4mRTow87myuFeWgncCRIHJnkIgH5HdLs3jboFw/SdiYWqXLQIuc91bk/8F6hUSJKaex7IAAAAASUVORK5CYII=\"/></a><nav aria-label=\"App sections\" class=\"mode-buttons section-tabs\"><button aria-pressed=\"true\" class=\"secondary\" id=\"activitiesTab\" type=\"button\"><svg class=\"tbi\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"4\" y=\"12\" width=\"4\" height=\"8\" rx=\"1\"/><rect x=\"10\" y=\"5\" width=\"4\" height=\"15\" rx=\"1\"/><rect x=\"16\" y=\"9\" width=\"4\" height=\"11\" rx=\"1\"/></svg><span data-i18n=\"الأنشطة\">الأنشطة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"wheelTab\" type=\"button\"><svg class=\"tbi\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4\"/></svg><span data-i18n=\"العجلة\">العجلة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"quizTab\" type=\"button\"><svg class=\"tbi\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 5h16v11H11l-4 4v-4H4z\"/><path d=\"M10 9.5a2 2 0 114 0c0 1.4-2 1.5-2 3\"/></svg><span data-i18n=\"كويز\">كويز</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"contactTab\" type=\"button\"><svg class=\"tbi\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7\"/></svg><span data-i18n=\"تواصل\">تواصل</span></button></nav><div aria-label=\"Language / اللغة\" class=\"language-switch\" dir=\"ltr\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"langAR\" lang=\"ar\" type=\"button\">AR</button><button aria-pressed=\"false\" class=\"secondary\" id=\"langEN\" lang=\"en\" type=\"button\">EN</button></div><button aria-pressed=\"false\" class=\"secondary theme-toggle\" id=\"themeToggle\" type=\"button\"><span aria-hidden=\"true\" class=\"theme-icon\">◐</span><span id=\"themeLabel\">الوضع الداكن</span></button></div><h1 class=\"sr\"><bdi><strong>RoomPulse</strong></bdi></h1></header><div id=\"globalError\" role=\"alert\"></div>\n<section id=\"welcome\"><div class=\"qhero qhero-act\" role=\"img\" aria-label=\"RoomPulse\"></div><div class=\"welcome-grid\"><div><span class=\"eyebrow\"><span data-i18n=\"للمدرب\">للمدرب</span></span><h2><span data-i18n=\"اسمع رأي القاعة\">اسمع رأي القاعة</span></h2><p><span data-i18n=\"اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.\">اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.</span></p><div class=\"actions\"><button id=\"startTrainer\"><span data-i18n=\"جهّز سؤال\">جهّز سؤال</span></button></div></div><div><span class=\"eyebrow\"><span data-i18n=\"للمتدرب\">للمتدرب</span></span><h2><span data-i18n=\"جاهز تشارك؟\">جاهز تشارك؟</span></h2><p><span data-i18n=\"معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.\">معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.</span></p><div class=\"actions\"><a class=\"btn secondary\" href=\"/join\"><span data-i18n=\"ادخل بكود السيشن\">ادخل بكود السيشن</span></a></div></div></div><section class=\"card\"><h2><span data-i18n=\"لف واختار\">لف واختار</span></h2><p><span data-i18n=\"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\">اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.</span></p><button id=\"openWheel\"><span data-i18n=\"العجلة\">العجلة</span></button></section><section class=\"card\"><span class=\"eyebrow\"><span data-i18n=\"للمدرب · القسم الثالث\">للمدرب · القسم الثالث</span></span><h2><span data-i18n=\"بنك أسئلة جاهزة\">بنك أسئلة جاهزة</span></h2><p><span data-i18n=\"٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.\">٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.</span></p><button class=\"secondary\" id=\"openBank\"><span data-i18n=\"اختار من بنك الأسئلة\">اختار من بنك الأسئلة</span></button></section><div class=\"notice hidden\" id=\"resumeBox\"><p><span data-i18n=\"عندك سيشن مفتوح على المتصفح ده.\">عندك سيشن مفتوح على المتصفح ده.</span></p><button class=\"secondary\" id=\"resume\"><span data-i18n=\"ارجع لشاشة المدرب\">ارجع لشاشة المدرب</span></button></div><div class=\"notice\"><strong><span data-i18n=\"نسخة أولية لايف\">نسخة أولية لايف</span></strong><p><span data-i18n=\"تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.\">تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.</span></p></div></section>\n<section class=\"hidden\" id=\"setup\"><span class=\"eyebrow\"><span data-i18n=\"من غير ما تنقل محتواك\">من غير ما تنقل محتواك</span></span><h2><span data-i18n=\"جهّز سؤال واحد\">جهّز سؤال واحد</span></h2><div class=\"notice hidden\" id=\"continuingRanking\"><p><span data-i18n=\"جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.\">جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.</span></p><button class=\"secondary\" id=\"separateRanking\" type=\"button\"><span data-i18n=\"ابدأ جولة منفصلة بدل دي\">ابدأ جولة منفصلة بدل دي</span></button></div><details class=\"bank-panel\" id=\"bankPanel\"><summary><span data-i18n=\"اختار من بنك الأسئلة · ٥٠ سؤال\">اختار من بنك الأسئلة · ٥٠ سؤال</span></summary><p class=\"muted\"><span data-i18n=\"اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.\">اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.</span></p><div aria-label=\"أقسام بنك الأسئلة\" class=\"bank-tabs\" data-i18n-aria-label=\"أقسام بنك الأسئلة\" id=\"bankTabs\" role=\"group\"></div><p id=\"bankCategory\"></p><div class=\"bank-list\" id=\"bankList\"></div><p class=\"success\" id=\"bankSelected\" role=\"status\"></p></details><label><span data-i18n=\"هوية المشاركين\">هوية المشاركين</span></label><div aria-label=\"هوية المشاركين\" class=\"mode-buttons\" data-i18n-aria-label=\"هوية المشاركين\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"identityAnonymous\"><span data-i18n=\"من غير أسماء\">من غير أسماء</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"identityNamed\"><span data-i18n=\"بالأسماء\">بالأسماء</span></button></div><p class=\"muted\" id=\"identityHint\"><span data-i18n=\"هتشوف الردود من غير أسماء، زي الوضع الحالي.\">هتشوف الردود من غير أسماء، زي الوضع الحالي.</span></p><label><span data-i18n=\"نوع الإجابة\">نوع الإجابة</span></label><div aria-label=\"نوع الإجابة\" class=\"mode-buttons\" data-i18n-aria-label=\"نوع الإجابة\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"modePoll\"><span data-i18n=\"اختيارات\">اختيارات</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"modeText\"><span data-i18n=\"إجابة مكتوبة\">إجابة مكتوبة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"modeRanking\" type=\"button\"><span data-i18n=\"رانكينج\">رانكينج</span></button></div><p class=\"muted\" id=\"modeHint\"><span data-i18n=\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\">المتدرب يختار إجابة واحدة من ٣ اختيارات.</span></p><section class=\"card hidden\" id=\"rankingSetup\"><h3><span data-i18n=\"إعدادات الرانكينج\">إعدادات الرانكينج</span></h3><p><span data-i18n=\"في إجابة صح؟\">في إجابة صح؟</span></p><div class=\"mode-buttons\"><button aria-pressed=\"true\" class=\"secondary\" id=\"rankingNoCorrect\" type=\"button\"><span data-i18n=\"من غير إجابة صح\">من غير إجابة صح</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"rankingHasCorrect\" type=\"button\"><span data-i18n=\"في إجابة صح\">في إجابة صح</span></button></div><div class=\"hidden\" id=\"correctChoiceBox\"><label for=\"correctChoice\"><span data-i18n=\"اختار الإجابة الصحيحة\">اختار الإجابة الصحيحة</span></label><select id=\"correctChoice\"><option data-i18n=\"اختار الإجابة الصحيحة\" value=\"\">اختار الإجابة الصحيحة</option><option data-i18n=\"الاختيار الأول\" value=\"0\">الاختيار الأول</option><option data-i18n=\"الاختيار الثاني\" value=\"1\">الاختيار الثاني</option><option data-i18n=\"الاختيار الثالث\" value=\"2\">الاختيار الثالث</option></select></div><p class=\"muted\"><span data-i18n=\"الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.\">الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.</span></p><p class=\"muted\"><span data-i18n=\"النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.\">النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.</span></p><p class=\"muted\"><span data-i18n=\"كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.\">كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.</span></p></section><section aria-labelledby=\"timerHeading\" class=\"timer-setup\"><h3 id=\"timerHeading\"><span data-i18n=\"مؤقت السؤال\">مؤقت السؤال</span></h3><div aria-label=\"Question timer\" class=\"mode-buttons\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"timerOff\" type=\"button\"><span data-i18n=\"من غير مؤقت\">من غير مؤقت</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"timerOn\" type=\"button\"><span data-i18n=\"بمؤقت\">بمؤقت</span></button></div><div class=\"hidden\" id=\"timerDuration\"><div class=\"timer-fields\"><div><label for=\"timerMinutes\"><span data-i18n=\"دقائق\">دقائق</span></label><input dir=\"ltr\" id=\"timerMinutes\" inputmode=\"numeric\" max=\"1439\" min=\"0\" step=\"1\" type=\"number\" value=\"1\"/></div><span aria-hidden=\"true\" class=\"timer-separator\">:</span><div><label for=\"timerSeconds\"><span data-i18n=\"ثواني\">ثواني</span></label><input dir=\"ltr\" id=\"timerSeconds\" inputmode=\"numeric\" max=\"59\" min=\"0\" step=\"1\" type=\"number\" value=\"0\"/></div></div><p class=\"muted\"><span data-i18n=\"قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.\">قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.</span></p></div><p class=\"muted\"><span data-i18n=\"المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.\">المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.</span></p></section><div class=\"fields\"><div><label for=\"title\"><span data-i18n=\"عنوان السيشن\">عنوان السيشن</span></label><input data-i18n-placeholder=\"اكتب عنوان السيشن\" dir=\"auto\" id=\"title\" maxlength=\"80\" placeholder=\"اكتب عنوان السيشن\" value=\"\"/></div><div><label for=\"question\"><span data-i18n=\"سؤال النقاش\">سؤال النقاش</span></label><input data-i18n-placeholder=\"اكتب سؤالك هنا\" dir=\"auto\" id=\"question\" maxlength=\"300\" placeholder=\"اكتب سؤالك هنا\" value=\"\"/></div><div class=\"option-field\"><label for=\"option0\"><span data-i18n=\"الاختيار ١\">الاختيار ١</span></label><input data-i18n-placeholder=\"اكتب الاختيار الأول\" dir=\"auto\" id=\"option0\" maxlength=\"200\" placeholder=\"اكتب الاختيار الأول\" value=\"\"/></div><div class=\"option-field\"><label for=\"option1\"><span data-i18n=\"الاختيار ٢\">الاختيار ٢</span></label><input data-i18n-placeholder=\"اكتب الاختيار الثاني\" dir=\"auto\" id=\"option1\" maxlength=\"200\" placeholder=\"اكتب الاختيار الثاني\" value=\"\"/></div><div class=\"option-field\" id=\"thirdOption\"><label for=\"option2\"><span data-i18n=\"الاختيار ٣\">الاختيار ٣</span></label><input data-i18n-placeholder=\"اكتب الاختيار الثالث\" dir=\"auto\" id=\"option2\" maxlength=\"200\" placeholder=\"اكتب الاختيار الثالث\" value=\"\"/></div></div><div class=\"actions\"><button id=\"create\"><span data-i18n=\"افتح السيشن اللايف\">افتح السيشن اللايف</span></button><a class=\"btn secondary\" href=\"/\"><span data-i18n=\"رجوع\">رجوع</span></a></div><div class=\"actions\" id=\"optionCount\"><button class=\"secondary\" id=\"twoOptions\"><span data-i18n=\"خيارين\">خيارين</span></button><button class=\"secondary\" id=\"threeOptions\"><span data-i18n=\"٣ اختيارات\">٣ اختيارات</span></button></div><p class=\"muted\"><span data-i18n=\"كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.\">كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.</span></p></section>\n<section class=\"hidden\" id=\"trainer\"><div class=\"status\" id=\"connection\" role=\"status\"><span class=\"dot\"></span><span data-i18n=\"جاري الاتصال…\">جاري الاتصال…</span></div><div aria-live=\"off\" class=\"countdown hidden\" id=\"trainerCountdown\" role=\"timer\"><span class=\"countdown-label\"></span><strong class=\"countdown-value\" dir=\"ltr\"></strong><p class=\"countdown-note hidden\"></p></div><h2 dir=\"auto\" id=\"trainerTitle\"></h2><div class=\"invite\"><div><span class=\"eyebrow\"><span data-i18n=\"كود دخول المتدربين\">كود دخول المتدربين</span></span><div class=\"code\" id=\"sessionCode\"></div><p class=\"muted\"><span data-i18n=\"امسح الـ QR أو افتح الرابط واكتب الكود.\">امسح الـ QR أو افتح الرابط واكتب الكود.</span></p><div class=\"actions\"><button class=\"secondary\" id=\"copyJoin\"><span data-i18n=\"انسخ رابط المتدربين\">انسخ رابط المتدربين</span></button><a class=\"btn secondary\" id=\"openJoin\" rel=\"noopener\" target=\"_blank\"><span data-i18n=\"افتح كمتدرب\">افتح كمتدرب</span></a></div><a class=\"url\" id=\"joinUrl\" rel=\"noopener\" target=\"_blank\"></a></div><figure class=\"qrbox\"><a id=\"qrLink\" rel=\"noopener\" target=\"_blank\"><img alt=\"QR لدخول السيشن على جهاز المتدرب\" data-i18n-alt=\"QR لدخول السيشن على جهاز المتدرب\" height=\"208\" id=\"qr\" width=\"208\"/></a><figcaption><span data-i18n=\"امسح الرمز بالموبايل للمشاركة\">امسح الرمز بالموبايل للمشاركة</span></figcaption></figure></div><section class=\"card\"><span class=\"eyebrow\" id=\"pollStatus\"></span><h2 dir=\"auto\" id=\"resultQuestion\"></h2><div class=\"metric\"><strong id=\"total\">0</strong><span><span data-i18n=\"ردود حقيقية\">ردود حقيقية</span></span></div><p class=\"muted\" id=\"empty\"><span data-i18n=\"لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.\">لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.</span></p><div class=\"results\" id=\"results\"></div><section class=\"hidden\" id=\"rankingResults\"><h3><span data-i18n=\"ترتيب السؤال\">ترتيب السؤال</span></h3><p class=\"muted\" id=\"rankingHint\"></p><div id=\"rankingList\"></div><p class=\"muted\"><span data-i18n=\"وقت الوصول للسيرفر من فتح السؤال\">وقت الوصول للسيرفر من فتح السؤال</span></p><div class=\"actions\"><button class=\"secondary\" id=\"nextRanking\"><span data-i18n=\"السؤال التالي في نفس الجولة\">السؤال التالي في نفس الجولة</span></button><button id=\"finishRanking\"><span data-i18n=\"إنهاء الجولة وعرض السكور\">إنهاء الجولة وعرض السكور</span></button></div><section class=\"hidden card\" id=\"roundResults\"><h3><span data-i18n=\"السكور النهائي للجولة\">السكور النهائي للجولة</span></h3><div id=\"roundList\"></div></section></section><section class=\"card hidden\" id=\"namedPollSection\"><h3><span data-i18n=\"مين اختار إيه؟\">مين اختار إيه؟</span></h3><div class=\"results\" id=\"namedPollAnswers\"></div></section><div class=\"actions\"><button class=\"secondary\" id=\"toggle\"><span data-i18n=\"اقفل التصويت\">اقفل التصويت</span></button><button class=\"secondary\" id=\"newSession\"><span data-i18n=\"سيشن جديد\">سيشن جديد</span></button></div><div class=\"notice hidden\" id=\"newConfirm\"><p><span data-i18n=\"هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.\">هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.</span></p><div class=\"actions\"><button id=\"confirmNew\"><span data-i18n=\"اقفل وابدأ جديد\">اقفل وابدأ جديد</span></button><button class=\"secondary\" id=\"cancelNew\"><span data-i18n=\"إلغاء\">إلغاء</span></button></div></div><div class=\"notice\" data-normal-only=\"true\"><strong><span data-i18n=\"حوّل التصويت لنقاش\">حوّل التصويت لنقاش</span></strong><p><span data-i18n=\"إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.\">إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.</span></p></div><p class=\"muted\"><span data-i18n=\"تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.\">تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.</span></p></section></section>\n<section class=\"hidden\" id=\"quiz\"><div id=\"quizRoot\"></div></section>\n<section class=\"hidden\" id=\"quizPlay\"><div id=\"quizPlayRoot\"></div></section>\n<section class=\"hidden\" id=\"contact\"><div class=\"ctc\"><div class=\"av\" aria-hidden=\"true\" data-i18n=\"ع\">ع</div><h2 data-i18n=\"عمر ناجي\">عمر ناجي</h2><p class=\"role\" data-i18n=\"صانع RoomPulse\">صانع RoomPulse</p><a class=\"ctr\" href=\"tel:+201065555507\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z\"/></svg><span><small data-i18n=\"الموبايل\">الموبايل</small><b>01065555507</b></span></a><a class=\"ctr\" href=\"mailto:omarnagycd@gmail.com\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 7l9 6 9-6\"/></svg><span><small data-i18n=\"الإيميل\">الإيميل</small><b>omarnagycd@gmail.com</b></span></a></div></section><section class=\"hidden\" id=\"join\"><span class=\"eyebrow\"><span data-i18n=\"شارك في النشاط\">شارك في النشاط</span></span><h2><span data-i18n=\"جاهز تشارك؟\">جاهز تشارك؟</span></h2><p><span data-i18n=\"اكتب الكود الظاهر في شاشة المدرب.\">اكتب الكود الظاهر في شاشة المدرب.</span></p><label for=\"joinCode\"><span data-i18n=\"كود السيشن\">كود السيشن</span></label><input autocomplete=\"off\" class=\"joincode\" id=\"joinCode\" inputmode=\"numeric\" maxlength=\"6\" placeholder=\"000000\"/><div class=\"actions\"><button id=\"joinButton\"><span data-i18n=\"ادخل النشاط\">ادخل النشاط</span></button></div></section>\n<section class=\"hidden\" id=\"participant\"><div class=\"status\" id=\"participantConnection\" role=\"status\"></div><div aria-live=\"off\" class=\"countdown hidden\" id=\"participantCountdown\" role=\"timer\"><span class=\"countdown-label\"></span><strong class=\"countdown-value\" dir=\"ltr\"></strong><p class=\"countdown-note hidden\"></p></div><span class=\"eyebrow\" id=\"answerType\"><span data-i18n=\"تصويت سريع · اختيار واحد\">تصويت سريع · اختيار واحد</span></span><div class=\"notice hidden\" id=\"rankingParticipantInfo\"><p><span data-i18n=\"ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.\">ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.</span></p><p id=\"rankingParticipantRule\"></p></div><h2 dir=\"auto\" id=\"participantTitle\"></h2><h3 dir=\"auto\" id=\"participantQuestion\"></h3><div class=\"notice hidden\" id=\"nameEntry\"><label for=\"participantName\"><span data-i18n=\"اسمك اللي هيظهر للمدرب\">اسمك اللي هيظهر للمدرب</span></label><input autocomplete=\"off\" data-i18n-placeholder=\"اكتب اسمك\" dir=\"auto\" id=\"participantName\" maxlength=\"200\" placeholder=\"اكتب اسمك\"/><p><span data-i18n=\"السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.\">السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.</span></p></div><div class=\"choices\" id=\"choices\"></div><div class=\"hidden\" id=\"textEntry\"><label for=\"writtenAnswer\"><span data-i18n=\"إجابتك\">إجابتك</span></label><textarea data-i18n-placeholder=\"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\" dir=\"auto\" id=\"writtenAnswer\" maxlength=\"500\" placeholder=\"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\"></textarea><div class=\"muted\"><span id=\"charCount\">0</span><span data-i18n=\" / 500 حرف\"> / 500 حرف</span></div><div class=\"notice\"><span id=\"textPrivacy\"><span data-i18n=\"ردك من غير اسم، وبيوصل للمدرب فقط.\">ردك من غير اسم، وبيوصل للمدرب فقط.</span></span><span data-i18n=\" ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.\"> ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.</span></div></div><div class=\"notice hidden\" id=\"voteStatus\" role=\"status\"></div><div class=\"actions\"><button disabled=\"\" id=\"vote\"><span data-i18n=\"ثبّت إجابتي\">ثبّت إجابتي</span></button><a class=\"btn secondary\" href=\"/join\"><span data-i18n=\"ادخل سيشن تاني\">ادخل سيشن تاني</span></a></div><p class=\"muted\" data-normal-only=\"true\"><span data-i18n=\"إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.\">إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.</span></p></section>\n<section class=\"hidden\" id=\"wheel\"><h2><span data-i18n=\"لف واختار\">لف واختار</span></h2><p><span data-i18n=\"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\">اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.</span></p><div class=\"wheel-layout\"><div class=\"wheel-editor\"><label for=\"wheelEntries\"><span data-i18n=\"العناصر\">العناصر</span></label><p class=\"muted\"><span data-i18n=\"كل اسم أو رقم أو عنصر في سطر منفصل.\">كل اسم أو رقم أو عنصر في سطر منفصل.</span></p><textarea data-i18n-placeholder=\"أسماء، أرقام، أفكار… كل عنصر في سطر\" dir=\"auto\" id=\"wheelEntries\" maxlength=\"25000\" placeholder=\"أسماء، أرقام، أفكار… كل عنصر في سطر\" rows=\"10\" spellcheck=\"false\"></textarea><p class=\"muted\" id=\"wheelCount\"></p><button class=\"secondary\" id=\"wheelClear\" type=\"button\"><span data-i18n=\"مسح العناصر\">مسح العناصر</span></button></div><div class=\"wheel-stage\"><canvas aria-label=\"عجلة اختيار عشوائي\" height=\"720\" id=\"wheelCanvas\" role=\"img\" width=\"720\"></canvas><button disabled=\"\" id=\"wheelSpin\" type=\"button\"><span data-i18n=\"لف العجلة\">لف العجلة</span></button><section aria-atomic=\"true\" aria-live=\"polite\" class=\"wheel-result hidden\" id=\"wheelResult\"><p><span data-i18n=\"الاختيار وقع على\">الاختيار وقع على</span></p><strong dir=\"auto\" id=\"wheelWinner\"></strong></section></div></div><div class=\"notice\"><p><span data-i18n=\"كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.\">كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.</span></p><p><span data-i18n=\"من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.\">من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.</span></p><p><span data-i18n=\"العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.\">العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.</span></p><p><span data-i18n=\"اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.\">اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.</span></p></div></section></main><script>\nconst EN={\"نشاط سريع · ردود حقيقية من كل جهاز\": \"Quick activity · Real replies from every device\", \"البداية\": \"Home\", \"سؤال واحد، كود واحد، ونقاش يشارك فيه الكل. بالاسم أو من غيره، ومن غير تسجيل حساب.\": \"One question. One code. Everyone joins the conversation. Named or anonymous, with no account needed.\", \"للمدرب\": \"FOR TRAINERS\", \"اسمع رأي القاعة\": \"Hear from everyone\", \"اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.\": \"Write a question, share the QR code and watch replies arrive from participants' devices.\", \"جهّز سؤال\": \"Prepare a question\", \"للمتدرب\": \"FOR PARTICIPANTS\", \"جاهز تشارك؟\": \"Ready to join?\", \"معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.\": \"Have a code from your trainer? Join the activity and share your answer.\", \"ادخل بكود السيشن\": \"Join with a session code\", \"للمدرب · القسم الثالث\": \"FOR TRAINERS · QUESTION BANK\", \"بنك أسئلة جاهزة\": \"A question to get things going\", \"٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.\": \"50 light-hearted questions in 5 categories. Pick one and make it your own before you start.\", \"اختار من بنك الأسئلة\": \"Browse the question bank\", \"عندك سيشن مفتوح على المتصفح ده.\": \"You have a session saved in this browser tab.\", \"ارجع لشاشة المدرب\": \"Return to trainer view\", \"نسخة أولية لايف\": \"Live pilot\", \"تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.\": \"Every device needs internet. Updates arrive every 5 seconds. Use test questions only, without customer data or sensitive information.\", \"من غير ما تنقل محتواك\": \"NO NEED TO REBUILD YOUR TRAINING\", \"جهّز سؤال واحد\": \"Prepare one question\", \"اختار من بنك الأسئلة · ٥٠ سؤال\": \"Browse the question bank · 50 questions\", \"اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.\": \"Picking a question only fills the fields. It does not start a session. Review and edit before going live.\", \"هوية المشاركين\": \"Participant identity\", \"من غير أسماء\": \"Anonymous\", \"بالأسماء\": \"Named\", \"هتشوف الردود من غير أسماء، زي الوضع الحالي.\": \"Replies will appear without participant names.\", \"نوع الإجابة\": \"Answer type\", \"اختيارات\": \"Multiple choice\", \"إجابة مكتوبة\": \"Written answer\", \"المتدرب يختار إجابة واحدة من ٣ اختيارات.\": \"Participants select one of three options.\", \"عنوان السيشن\": \"Session title\", \"سؤال النقاش\": \"Discussion question\", \"الاختيار ١\": \"Option 1\", \"الاختيار ٢\": \"Option 2\", \"الاختيار ٣\": \"Option 3\", \"افتح السيشن اللايف\": \"Start live session\", \"رجوع\": \"Back\", \"خيارين\": \"Two options\", \"٣ اختيارات\": \"Three options\", \"كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.\": \"Each session has one question, with multiple-choice or written answers, and lasts 24 hours. This is not a certified exam or a work-readiness assessment.\", \"جاري الاتصال…\": \"Connecting…\", \"كود دخول المتدربين\": \"PARTICIPANT JOIN CODE\", \"امسح الـ QR أو افتح الرابط واكتب الكود.\": \"Scan the QR code, or open the link and enter the code.\", \"انسخ رابط المتدربين\": \"Copy participant link\", \"افتح كمتدرب\": \"Open participant view\", \"امسح الرمز بالموبايل للمشاركة\": \"Scan with your phone to join\", \"ردود حقيقية\": \"Real replies\", \"لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.\": \"No replies yet. Share the code or QR with the room.\", \"مين اختار إيه؟\": \"Who chose what?\", \"اقفل التصويت\": \"Close voting\", \"سيشن جديد\": \"New session\", \"هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.\": \"This closes the current session to replies and prepares a new question. Current results stay available until the session expires.\", \"اقفل وابدأ جديد\": \"Close and start new\", \"إلغاء\": \"Cancel\", \"حوّل التصويت لنقاش\": \"Turn replies into a discussion\", \"إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.\": \"What made you choose that answer? What else would you want to know? There is no automatic marking or participant ranking.\", \"تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.\": \"Refreshing this tab is safe. Closing the tab or switching browsers may lose trainer control. Participant links do not grant control. Sessions become unavailable after 24 hours and are deleted during the next cleanup.\", \"شارك في النشاط\": \"JOIN THE ACTIVITY\", \"اكتب الكود الظاهر في شاشة المدرب.\": \"Enter the code shown on your trainer's screen.\", \"كود السيشن\": \"Session code\", \"ادخل النشاط\": \"Join activity\", \"تصويت سريع · اختيار واحد\": \"QUICK POLL · CHOOSE ONE\", \"اسمك اللي هيظهر للمدرب\": \"Your display name for the trainer\", \"السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.\": \"This is a named session. The trainer sees your name and answer and may project the results. Enter only the name or nickname you want displayed, without any other personal details.\", \"إجابتك\": \"Your answer\", \" / 500 حرف\": \" / 500 characters\", \"ردك من غير اسم، وبيوصل للمدرب فقط.\": \"Your reply is anonymous and is sent only to the trainer.\", \" ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.\": \" The trainer may project the screen. Do not include personal information or customer data.\", \"ثبّت إجابتي\": \"Submit my answer\", \"ادخل سيشن تاني\": \"Join another session\", \"إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.\": \"One reply per browser in each session. This is a discussion tool, not an exam system. Another browser can submit again. Do not include personal information.\", \"نسخة أولية مجانية · تحتاج اتصالاً بالإنترنت · من غير ردود محاكاة · الردود والأسئلة محفوظة مؤقتاً على Cloudflare\": \"Free pilot · Internet required · No simulated replies · Questions and replies are stored temporarily on Cloudflare\", \"أقسام بنك الأسئلة\": \"Question bank categories\", \"QR لدخول السيشن على جهاز المتدرب\": \"Scan this QR code to join on a participant device\", \"اكتب اسمك\": \"Enter your name or nickname\", \"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\": \"Share your thoughts, without names or personal information…\", \"التعامل مع عميل غاضب\": \"Handling an upset customer\", \"عميل متضايق لأن طلبه اتأخر. تبدأ بإيه؟\": \"A customer is upset about a delayed order. How do you start?\", \"أشرح سياسة الشركة فوراً\": \"Explain company policy right away\", \"أسمع المشكلة وأتأكد إني فاهمها\": \"Listen and check that I understand the problem\", \"أحوّله لقسم تاني من غير توضيح\": \"Transfer them without explaining\", \"حصل خطأ. جرّب تاني.\": \"Something went wrong. Please try again.\", \"تعذّر الاتصال بالخدمة. اتأكد من الإنترنت وجرّب تاني.\": \"Could not connect. Check your internet and try again.\", \"تعذّر تنفيذ الطلب.\": \"Could not complete the request.\", \"كل مشارك هيكتب اسمه، وهتشوف اسمه جنب إجابته. قول للقاعة قبل المشاركة.\": \"Each participant enters a name, shown beside their answer. Tell the room before they join.\", \"المتدرب يختار إجابة واحدة من خيارين.\": \"Participants select one of two options.\", \"المتدرب يكتب رد واحد لحد ٥٠٠ حرف. ظهور الاسم حسب وضع الهوية اللي اخترته فوق.\": \"Participants write one reply of up to 500 characters. Names follow the identity mode selected above.\", \" · ١٠ أسئلة\": \" · 10 questions\", \"مكتوبة\": \"Written\", \"اتختار السؤال \": \"Selected question \", \". راجع الحقول وعدّل قبل ما تبدأ.\": \". Review and edit the fields before you start.\", \"كمّل عنوان السيشن والسؤال وكل الاختيارات.\": \"Complete the session title, question and all options.\", \"استقبال الردود مفتوح\": \"Replies are open\", \"التصويت مفتوح\": \"Voting is open\", \"استقبال الردود مقفول\": \"Replies are closed\", \"التصويت مقفول\": \"Voting is closed\", \"اقفل الردود\": \"Close replies\", \"افتح الردود\": \"Open replies\", \"افتح التصويت\": \"Open voting\", \"مشارك\": \"Participant\", \"رد \": \"Reply \", \"متصل · آخر تحديث \": \"Connected · Last updated \", \"التحديث متوقف مؤقتاً، بنحاول تاني\": \"Updates paused. Retrying…\", \"اتنسخ الرابط\": \"Link copied\", \"انسخ الرابط المكتوب تحت الزر\": \"Copy the link below this button\", \"اكتب كود السيشن المكوّن من ٦ أرقام.\": \"Enter the 6-digit session code.\", \"ردك واسمك بيوصلوا للمدرب فقط.\": \"Your name and reply are sent only to the trainer.\", \"سؤال مفتوح · إجابة مكتوبة\": \"OPEN QUESTION · WRITTEN ANSWER\", \"ابعث إجابتي\": \"Send my answer\", \"اتسجّل ردك ووصل للمدرب. شكراً لمشاركتك.\": \"Your reply reached the trainer. Thanks for taking part.\", \"المدرب قفل استقبال الردود. لو فتحه تاني هتقدر تشارك.\": \"The trainer has closed replies. You can join in if they reopen them.\", \"متصل · استقبال الردود مفتوح\": \"Connected · Replies are open\", \"متصل · استقبال الردود مقفول\": \"Connected · Replies are closed\", \"تعذّر تحديث حالة السيشن\": \"Could not update the session status\", \"حجم الطلب أكبر من المسموح.\": \"The request is too large.\", \"بيانات الطلب غير صحيحة.\": \"The request data is invalid.\", \"كمّل السؤال والاختيارات، والتزم بالطول المسموح.\": \"Complete the question and options within the length limits.\", \"كود غير صحيح.\": \"Invalid code.\", \"الخدمة قيد التجهيز. جرّب بعد قليل.\": \"The service is getting ready. Try again shortly.\", \"مطلوب خيارين أو ٣ اختيارات.\": \"Provide two or three options.\", \"وصلنا للحد التجريبي اليومي. جرّب لاحقاً.\": \"The pilot session limit has been reached. Try again later.\", \"تعذّر إنشاء كود جديد. جرّب تاني.\": \"Could not create a new code. Please try again.\", \"الرابط مش موجود.\": \"This link does not exist.\", \"مفيش سيشن بالكود ده. اتأكد من الكود.\": \"No session was found. Check the code.\", \"الكود غير صحيح أو السيشن انتهى. اتأكد من المدرب.\": \"The code is invalid or the session has expired. Check with the trainer.\", \"بيانات المتصفح غير صحيحة.\": \"Invalid browser data.\", \"اكتب الاسم اللي تحب تظهر بيه، لحد ٢٠٠ حرف.\": \"Enter a display name, up to 200 characters.\", \"المدرب قفل استقبال الردود.\": \"The trainer has closed replies.\", \"المدرب قفل الردود.\": \"The trainer has closed replies.\", \"استقبال الردود مقفول أو وصل للحد التجريبي.\": \"Replies are closed or the pilot reply limit has been reached.\", \"اختار إجابة صحيحة.\": \"Choose a valid option.\", \"المدرب قفل التصويت.\": \"The trainer has closed voting.\", \"التصويت مقفول أو وصل للحد التجريبي.\": \"Voting is closed or the pilot reply limit has been reached.\", \"شاشة المدرب دي مش متاحة من المتصفح الحالي.\": \"Trainer access is not available in this browser tab.\", \"حالة التصويت غير صحيحة.\": \"Invalid voting status.\", \"الطلب غير مسموح.\": \"This request is not allowed.\", \"تعذّر الاتصال بالخدمة. جرّب تاني بعد قليل.\": \"Could not connect to the service. Try again shortly.\", \"مؤقت السؤال\": \"Question timer\", \"من غير مؤقت\": \"No timer\", \"بمؤقت\": \"Timed\", \"المدة\": \"Duration\", \"دقائق\": \"Minutes\", \"ثواني\": \"Seconds\", \"المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.\": \"The timer is optional. It starts when you open the live session and closes replies automatically at zero.\", \"قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.\": \"Closing and reopening replies does not pause or reset the timer. After zero, start a new session to continue.\", \"الوقت المتبقي\": \"Time remaining\", \"الوقت خلص\": \"Time is up\", \"الوقت خلص. استقبال الردود اتقفل تلقائياً.\": \"Time is up. Replies closed automatically.\", \"الوقت خلص. ابدأ سيشن جديد لو عايز تكمل.\": \"Time is up. Start a new session to continue.\", \"اختار مدة صحيحة من ثانية لحد ٢٣ ساعة و٥٩ دقيقة و٥٩ ثانية، أو اقفل المؤقت.\": \"Choose a duration from 1 second to 23 hours, 59 minutes and 59 seconds, or turn the timer off.\", \"اكتب الدقائق من ٠ لحد ١٤٣٩ والثواني من ٠ لحد ٥٩. المدة لازم تكون ثانية على الأقل.\": \"Enter 0–1439 minutes and 0–59 seconds, with a total duration of at least 1 second.\", \"الوضع الداكن\": \"Dark mode\", \"الوضع الفاتح\": \"Light mode\", \"تغيير المظهر\": \"Change appearance\"};\nObject.assign(EN,{\"اكتب عنوان السيشن\": \"Enter a session title\", \"اكتب سؤالك هنا\": \"Write your question here\", \"اكتب الاختيار الأول\": \"Enter the first option\", \"اكتب الاختيار الثاني\": \"Enter the second option\", \"اكتب الاختيار الثالث\": \"Enter the third option\"});\nObject.assign(EN,{\"رانكينج\": \"Ranking\", \"إعدادات الرانكينج\": \"Ranking settings\", \"في إجابة صح؟\": \"Does this question have a correct answer?\", \"من غير إجابة صح\": \"No correct answer\", \"في إجابة صح\": \"Has a correct answer\", \"اختار الإجابة الصحيحة\": \"Choose the correct option\", \"الاختيار الأول\": \"First option\", \"الاختيار الثاني\": \"Second option\", \"الاختيار الثالث\": \"Third option\", \"الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.\": \"Ranking uses selectable options. Speed is measured from question opening to server receipt, so network speed affects the result. With a correct option, only correct answers are ranked.\", \"النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.\": \"Points per question: 1000 ÷ place, rounded down, minimum 1 point. Equal times share a place and points.\", \"ترتيب السؤال\": \"Question ranking\", \"اقفل الردود أو استنى المؤقت يخلص عشان يظهر ترتيب السؤال.\": \"Close replies or wait for the timer to see the question ranking.\", \"مفيش إجابات مؤهلة للترتيب لسه.\": \"No eligible answers to rank.\", \"السكور النهائي للجولة\": \"Final round scores\", \"السؤال التالي في نفس الجولة\": \"Next question in this round\", \"إنهاء الجولة وعرض السكور\": \"End round and show scores\", \"إنهاء الجولة يقفل كل أسئلتها نهائياً. متأكد؟\": \"Ending the round permanently closes all its questions. Continue?\", \"نقطة\": \"points\", \"ثانية\": \"seconds\", \"مشارك \": \"Participant \", \"إجابات مؤهلة\": \"eligible answers\", \"جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.\": \"Continuing a ranking round. Participants must use the same browser for every question to combine scores. Each question has a new code and QR.\", \"ابدأ جولة منفصلة بدل دي\": \"Start a separate round instead\", \"رانكينج · أسرع إجابة\": \"Ranking · Fastest answer\", \"رانكينج · أسرع إجابة صحيحة\": \"Ranking · Fastest correct answer\", \"ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.\": \"The trainer sees rankings after the question closes. Use the same browser throughout the round.\", \"الجولة انتهت. ابدأ جولة جديدة.\": \"This round has ended. Start a new round.\", \"اختار الإجابة الصحيحة من الاختيارات.\": \"Choose a correct option from the available options.\", \"خلي وضع الأسماء ثابت في نفس الجولة.\": \"Keep the same name setting for this round.\", \"الجولة وصلت ٥٠ سؤال. ابدأ جولة جديدة.\": \"This round has reached 50 questions. Start a new round.\", \"الجولة دي مش متاحة من المتصفح الحالي.\": \"This round is not available in this browser.\", \"جولة غير صحيحة.\": \"Invalid round.\", \"كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.\": \"Each question has a new code. Use the same browser for every question. Results are temporary for 24 hours, like the other modes.\", \"جولة جديدة\": \"New round\", \"المركز\": \"Place\", \"المشارك\": \"Participant\", \"الوقت\": \"Time\", \"النقاط\": \"Points\", \"وقت الوصول للسيرفر من فتح السؤال\": \"Server receipt time from question opening\", \"الهوية في الجولة\": \"Identity in this round\", \"الإجابات غير الصحيحة لا تأخذ نقاط.\": \"Incorrect answers receive no points.\", \"الجولة خلصت. السكور النهائي ظاهر تحت.\": \"Round ended. Final scores are shown below.\"});\nObject.assign(EN,{\"العجلة\": \"Wheel\", \"الأنشطة\": \"Activities\", \"لف واختار\": \"Spin and pick\", \"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\": \"Pick randomly from names, numbers or any entries you write.\", \"العناصر\": \"Entries\", \"كل اسم أو رقم أو عنصر في سطر منفصل.\": \"One name, number or entry per line.\", \"أسماء، أرقام، أفكار… كل عنصر في سطر\": \"Names, numbers, ideas… one entry per line\", \"لف العجلة\": \"Spin the wheel\", \"بتلف…\": \"Spinning…\", \"مسح العناصر\": \"Clear entries\", \"تمسح كل عناصر العجلة؟\": \"Clear every wheel entry?\", \"الاختيار وقع على\": \"The wheel picked\", \"عنصر\": \"entries\", \"أضف العناصر\": \"Add entries\", \"عجلة اختيار عشوائي\": \"Random picker wheel\", \"اكتب عنصرين على الأقل، كل عنصر في سطر.\": \"Enter at least two entries, one per line.\", \"الحد الأقصى ٢٠٠ عنصر في اللفة.\": \"A spin supports up to 200 entries.\", \"كل عنصر لحد ١٠٠ حرف.\": \"Each entry can have up to 100 characters.\", \"كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.\": \"Each line has an equal chance. Repeated entries increase their chance. The winner stays in the list for the next spin.\", \"من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.\": \"Use 2 to 200 entries, up to 100 characters each. Large lists show colored segments and the full result below.\", \"العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.\": \"Entries stay on this page only. They are not sent to the server and are not kept after a refresh.\", \"اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.\": \"Random picking for activities and small prizes, not a certified draw or a money game.\"});\nlet lang='ar';try{lang=new URLSearchParams(location.search).get('lang')||localStorage.getItem('roompulse.language')||'ar'}catch{}if(!['ar','en'].includes(lang))lang='ar';\nconst t=s=>lang==='en'?(EN[s]??s):s;\nfunction localBank(x){return lang==='en'?{...x,...x.en}:x}\nfunction applyLanguage(){applyTheme();renderWheelLanguage();document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));for(const a of ['placeholder','alt','aria-label'])document.querySelectorAll('[data-i18n-'+a+']').forEach(e=>e.setAttribute(a,t(e.getAttribute('data-i18n-'+a))));document.querySelectorAll('[data-default-ar]').forEach(e=>{if([e.dataset.defaultAr,e.dataset.defaultEn].includes(e.value))e.value=lang==='en'?e.dataset.defaultEn:e.dataset.defaultAr});$('langAR').setAttribute('aria-pressed',String(lang==='ar'));$('langEN').setAttribute('aria-pressed',String(lang==='en'));document.querySelectorAll('a').forEach(e=>{if(!e.dataset.route&&['/','/join'].includes(e.getAttribute('href')))e.dataset.route=e.getAttribute('href');if(e.dataset.route)e.href=(e.dataset.route==='/join'?joinPath:appBase)+'?lang='+lang});moveSectionPill()}\nfunction setLanguage(v){lang=v;try{localStorage.setItem('roompulse.language',v)}catch{}const u=new URL(location);u.searchParams.set('lang',lang);history.replaceState(null,'',u);applyLanguage();renderBank();setIdentity(identity);setMode(mode);updateCountdown();$('copyJoin').textContent=t('انسخ رابط المتدربين');if($('bankSelected').dataset.questionId)$('bankSelected').textContent=t('اتختار السؤال ')+$('bankSelected').dataset.questionId+t('. راجع الحقول وعدّل قبل ما تبدأ.');if(lastError)$('globalError').textContent=t(lastError);if(role==='participant'&&current)renderParticipant();if(role==='trainer'&&current){renderRanking(current);const u=location.origin+joinPath+'?code='+current.code+'&lang='+lang;for(const id of ['joinUrl','openJoin','qrLink'])$(id).href=u;$('joinUrl').textContent=u;$('qr').src=apiOrigin+'/qr?code='+current.code+'&lang='+lang+(pagesHost?'&frontend=pages':'');refreshTrainer()}}\n\nlet lastError='';const $=id=>document.getElementById(id);let current=null,selected=-1,timer=null,role='',sending=false,mode='poll',optionCount=3,identity='anonymous';\nconst esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nfunction show(id){const previous=role;for(const n of ['welcome','setup','trainer','join','participant','wheel','quiz','quizPlay','contact'])$(n).classList.toggle('hidden',n!==id);role=id;$('activitiesTab').setAttribute('aria-pressed',String(id!=='wheel'&&id!=='quiz'&&id!=='contact'));$('contactTab').setAttribute('aria-pressed',String(id==='contact'));$('wheelTab').setAttribute('aria-pressed',String(id==='wheel'));$('quizTab').setAttribute('aria-pressed',String(id==='quiz'));document.querySelector('.section-tabs').classList.toggle('hidden',id==='join'||id==='participant'||id==='quizPlay');updateCountdown();$('globalError').textContent='';lastError='';clearInterval(timer);timer=null;window.scrollTo(0,0);moveSectionPill();if(previous&&previous!==id&&!matchMedia('(prefers-reduced-motion: reduce)').matches){$(id).animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'})}}\nfunction error(e){lastError=Object.keys(EN).find(k=>EN[k]===e.message)||e.message;$('globalError').textContent=t(lastError)||t(\"حصل خطأ. جرّب تاني.\")}\nfunction saved(){try{return JSON.parse(sessionStorage.getItem('hall.trainer')||'null')}catch{return null}}\nfunction save(v){try{sessionStorage.setItem('hall.trainer',JSON.stringify(v))}catch{}}\nfunction client(){try{let v=localStorage.getItem('hall.device');if(!v){v=crypto.randomUUID();localStorage.setItem('hall.device',v)}return v}catch{return memoryClient}}\nconst memoryClient=crypto.randomUUID();\nconst pagesHost=location.origin==='https://omarnagycd.github.io';const apiOrigin=pagesHost?'https://roompulse.s21smk.workers.dev':'';const appBase=pagesHost?'/RoomPulse/':'/';const joinPath=pagesHost?appBase+'join/':'/join';\nasync function api(path,body,token){const r=await fetch(apiOrigin+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});let d;try{d=await r.json()}catch{throw new Error(t(\"تعذّر الاتصال بالخدمة. اتأكد من الإنترنت وجرّب تاني.\"))}if(d.serverNow)d.receivedAt=performance.now();if(!r.ok)throw new Error(d.error||t(\"تعذّر تنفيذ الطلب.\"));return d}\nfunction setIdentity(v){identity=v;$('identityAnonymous').setAttribute('aria-pressed',String(v==='anonymous'));$('identityNamed').setAttribute('aria-pressed',String(v==='named'));$('identityHint').textContent=v==='named'?t(\"كل مشارك هيكتب اسمه، وهتشوف اسمه جنب إجابته. قول للقاعة قبل المشاركة.\"):t(\"هتشوف الردود من غير أسماء، زي الوضع الحالي.\")} $('identityAnonymous').onclick=()=>setIdentity('anonymous');$('identityNamed').onclick=()=>setIdentity('named');$('participantName').oninput=()=>{try{sessionStorage.setItem('hall.name',$('participantName').value)}catch{}renderParticipant()};\nfunction setOptionCount(n){if($('correctChoice')){$('correctChoice').options[3].hidden=n===2;if(Number($('correctChoice').value)>=n)$('correctChoice').value='';}optionCount=n;$('thirdOption').classList.toggle('hidden',mode==='text'||n===2);$('twoOptions').setAttribute('aria-pressed',String(n===2));$('threeOptions').setAttribute('aria-pressed',String(n===3));if(mode==='poll')$('modeHint').textContent=n===2?t(\"المتدرب يختار إجابة واحدة من خيارين.\"):t(\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\")} $('twoOptions').onclick=()=>setOptionCount(2);$('threeOptions').onclick=()=>setOptionCount(3);\nfunction setMode(v){if(pendingRanking)v='ranking';mode=v;$('modeRanking').setAttribute('aria-pressed',String(v==='ranking'));$('rankingSetup').classList.toggle('hidden',v!=='ranking');$('modePoll').setAttribute('aria-pressed',String(v==='poll'));$('modeText').setAttribute('aria-pressed',String(v==='text'));for(const el of document.querySelectorAll('.option-field'))el.classList.toggle('hidden',v==='text');$('modeHint').textContent=v==='text'?t(\"المتدرب يكتب رد واحد لحد ٥٠٠ حرف. ظهور الاسم حسب وضع الهوية اللي اخترته فوق.\"):t(\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\");$('optionCount').classList.toggle('hidden',v==='text');setOptionCount(optionCount);if(v==='ranking')$('modeHint').textContent=t('رانكينج · أسرع إجابة')} $('modeRanking').onclick=()=>setMode('ranking');$('modePoll').onclick=()=>setMode('poll');$('modeText').onclick=()=>setMode('text');$('writtenAnswer').oninput=()=>{$('charCount').textContent=$('writtenAnswer').value.length;$('vote').disabled=!$('writtenAnswer').value.trim()||(current?.identity==='named'&&!$('participantName').value.trim())||!current?.open||current?.voted||sending};\nconst bank=[{\"id\": 1, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أكلة تقدر تاكلها كل يوم من غير زهق؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What food could you eat every day without getting bored?\", \"options\": []}}, {\"id\": 2, \"category\": \"كسرة جليد سريعة\", \"question\": \"آخر صورة على موبايلك، إيه حكايتها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the story behind the last photo on your phone?\", \"options\": []}}, {\"id\": 3, \"category\": \"كسرة جليد سريعة\", \"question\": \"شاي ولا قهوة؟ ومحدش يزعل\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"Tea or coffee? No hard feelings!\", \"options\": []}}, {\"id\": 4, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أول حاجة بتعملها أول ما تصحى؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the first thing you do when you wake up?\", \"options\": []}}, {\"id\": 5, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه اسم فيلم ممكن تتفرج عليه ١٠ مرات؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What film could you watch ten times?\", \"options\": []}}, {\"id\": 6, \"category\": \"كسرة جليد سريعة\", \"question\": \"آخر أغنية سمعتها وعجبتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What was the last song you heard and liked?\", \"options\": []}}, {\"id\": 7, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أغرب حاجة في شنطتك دلوقتي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the strangest thing in your bag right now?\", \"options\": []}}, {\"id\": 8, \"category\": \"كسرة جليد سريعة\", \"question\": \"لو يومك ٢٥ ساعة، الساعة الزيادة تعمل فيها إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"If your day had 25 hours, what would you do with the extra hour?\", \"options\": []}}, {\"id\": 9, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه اسم أول موبايل كان عندك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What was your first mobile phone?\", \"options\": []}}, {\"id\": 10, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أطرف كلمة مصرية بتحب تقولها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What Egyptian expression do you find funniest?\", \"options\": []}}, {\"id\": 11, \"category\": \"لو كنت...\", \"question\": \"لو كنت شخصية كرتون، تكون مين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you were a cartoon character, who would you be?\", \"options\": []}}, {\"id\": 12, \"category\": \"لو كنت...\", \"question\": \"لو تقدر تسافر أي حتة بكرة، تروح فين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could travel anywhere tomorrow, where would you go?\", \"options\": []}}, {\"id\": 13, \"category\": \"لو كنت...\", \"question\": \"لو عندك قوة خارقة واحدة، تختار إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could have one superpower, what would it be?\", \"options\": []}}, {\"id\": 14, \"category\": \"لو كنت...\", \"question\": \"لو حياتك فيلم، مين يمثل دورك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your life were a film, who would play you?\", \"options\": []}}, {\"id\": 15, \"category\": \"لو كنت...\", \"question\": \"لو تقدر تقابل أي حد في العالم، مين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could meet anyone in the world, who would it be?\", \"options\": []}}, {\"id\": 16, \"category\": \"لو كنت...\", \"question\": \"لو تشتغل أي شغلانة تانية خالص، تكون إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could do any completely different job, what would it be?\", \"options\": []}}, {\"id\": 17, \"category\": \"لو كنت...\", \"question\": \"لو فلوسك مش هتخلص أبداً، أول حاجة تشتريها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your money could never run out, what would you buy first?\", \"options\": []}}, {\"id\": 18, \"category\": \"لو كنت...\", \"question\": \"لو ترجع بالزمن ١٠ سنين، هتقول لنفسك إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could go back ten years, what would you tell yourself?\", \"options\": []}}, {\"id\": 19, \"category\": \"لو كنت...\", \"question\": \"لو تعيش في أي عصر تاني، تختار أنهي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could live in another era, which would you choose?\", \"options\": []}}, {\"id\": 20, \"category\": \"لو كنت...\", \"question\": \"لو اسمك براند، هيبقى براند إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your name were a brand, what kind of brand would it be?\", \"options\": []}}, {\"id\": 21, \"category\": \"ده ولا ده\", \"question\": \"بحر ولا جبل؟\", \"mode\": \"poll\", \"options\": [\"بحر\", \"جبل\"], \"en\": {\"category\": \"This or that\", \"question\": \"Beach or mountains?\", \"options\": [\"Beach\", \"Mountains\"]}}, {\"id\": 22, \"category\": \"ده ولا ده\", \"question\": \"صيف ولا شتا؟\", \"mode\": \"poll\", \"options\": [\"صيف\", \"شتا\"], \"en\": {\"category\": \"This or that\", \"question\": \"Summer or winter?\", \"options\": [\"Summer\", \"Winter\"]}}, {\"id\": 23, \"category\": \"ده ولا ده\", \"question\": \"كشري ولا فول وطعمية؟\", \"mode\": \"poll\", \"options\": [\"كشري\", \"فول وطعمية\"], \"en\": {\"category\": \"This or that\", \"question\": \"Koshari or ful medames and falafel?\", \"options\": [\"Koshari\", \"Ful medames and falafel\"]}}, {\"id\": 24, \"category\": \"ده ولا ده\", \"question\": \"قطط ولا كلاب؟\", \"mode\": \"poll\", \"options\": [\"قطط\", \"كلاب\"], \"en\": {\"category\": \"This or that\", \"question\": \"Cats or dogs?\", \"options\": [\"Cats\", \"Dogs\"]}}, {\"id\": 25, \"category\": \"ده ولا ده\", \"question\": \"تسهر ولا تصحى بدري؟\", \"mode\": \"poll\", \"options\": [\"تسهر\", \"تصحى بدري\"], \"en\": {\"category\": \"This or that\", \"question\": \"Stay up late or wake up early?\", \"options\": [\"Stay up late\", \"Wake up early\"]}}, {\"id\": 26, \"category\": \"ده ولا ده\", \"question\": \"فطار ولا عشا؟\", \"mode\": \"poll\", \"options\": [\"فطار\", \"عشا\"], \"en\": {\"category\": \"This or that\", \"question\": \"Breakfast or dinner?\", \"options\": [\"Breakfast\", \"Dinner\"]}}, {\"id\": 27, \"category\": \"ده ولا ده\", \"question\": \"نتفليكس ولا سينما؟\", \"mode\": \"poll\", \"options\": [\"نتفليكس\", \"سينما\"], \"en\": {\"category\": \"This or that\", \"question\": \"Netflix or cinema?\", \"options\": [\"Netflix\", \"Cinema\"]}}, {\"id\": 28, \"category\": \"ده ولا ده\", \"question\": \"مدينة ولا قرية؟\", \"mode\": \"poll\", \"options\": [\"مدينة\", \"قرية\"], \"en\": {\"category\": \"This or that\", \"question\": \"City or village?\", \"options\": [\"City\", \"Village\"]}}, {\"id\": 29, \"category\": \"ده ولا ده\", \"question\": \"حلو ولا حادق؟\", \"mode\": \"poll\", \"options\": [\"حلو\", \"حادق\"], \"en\": {\"category\": \"This or that\", \"question\": \"Sweet or savoury?\", \"options\": [\"Sweet\", \"Savoury\"]}}, {\"id\": 30, \"category\": \"ده ولا ده\", \"question\": \"موبايل ولا لابتوب؟\", \"mode\": \"poll\", \"options\": [\"موبايل\", \"لابتوب\"], \"en\": {\"category\": \"This or that\", \"question\": \"Phone or laptop?\", \"options\": [\"Phone\", \"Laptop\"]}}, {\"id\": 31, \"category\": \"ضحك\", \"question\": \"إيه أغرب حاجة عملتها وانت صغير؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the strangest thing you did as a child?\", \"options\": []}}, {\"id\": 32, \"category\": \"ضحك\", \"question\": \"إيه أكتر كذبة صدقتها وانت طفل؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the biggest lie you believed as a child?\", \"options\": []}}, {\"id\": 33, \"category\": \"ضحك\", \"question\": \"إيه أسوأ هدية وصلتك في حياتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the worst gift you have ever received?\", \"options\": []}}, {\"id\": 34, \"category\": \"ضحك\", \"question\": \"إيه موقف محرج لسه فاكره لحد دلوقتي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What embarrassing moment do you still remember?\", \"options\": []}}, {\"id\": 35, \"category\": \"ضحك\", \"question\": \"لو في مسابقة أكل، تكسب في أنهي أكلة؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What food would you win an eating contest with?\", \"options\": []}}, {\"id\": 36, \"category\": \"ضحك\", \"question\": \"إيه أطرف اسم دلع اتناديت بيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the funniest nickname you have ever had?\", \"options\": []}}, {\"id\": 37, \"category\": \"ضحك\", \"question\": \"لو حياتك مسلسل، هيبقى كوميدي ولا دراما؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"If your life were a TV series, would it be a comedy or a drama?\", \"options\": []}}, {\"id\": 38, \"category\": \"ضحك\", \"question\": \"إيه أكتر حاجة بتضحكك مهما كان مودك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What always makes you laugh, whatever your mood?\", \"options\": []}}, {\"id\": 39, \"category\": \"ضحك\", \"question\": \"إيه موقف \\\"أنا مش مصدق إني عملت كده\\\" وفخور بيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is something you cannot believe you did, but feel proud of?\", \"options\": []}}, {\"id\": 40, \"category\": \"ضحك\", \"question\": \"إيه أغرب مكان نمت فيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the strangest place you have slept?\", \"options\": []}}, {\"id\": 41, \"category\": \"موودك\", \"question\": \"إيه الحاجة اللي بتشحن طاقتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What recharges your energy?\", \"options\": []}}, {\"id\": 42, \"category\": \"موودك\", \"question\": \"اكتب حاجة واحدة بتحبها في نفسك\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Write one thing you like about yourself.\", \"options\": []}}, {\"id\": 43, \"category\": \"موودك\", \"question\": \"إيه أحلى حاجة حصلتلك الأسبوع ده؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What is the nicest thing that happened to you this week?\", \"options\": []}}, {\"id\": 44, \"category\": \"موودك\", \"question\": \"لو مودك النهاردة طقس، يبقى إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"If your mood today were weather, what would it be?\", \"options\": []}}, {\"id\": 45, \"category\": \"موودك\", \"question\": \"إيه أكلة نفسك فيها دلوقتي حالاً؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What food are you craving right now?\", \"options\": []}}, {\"id\": 46, \"category\": \"موودك\", \"question\": \"إيه الشغلانة اللي مستحيل تعملها أبداً؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What job would you never do?\", \"options\": []}}, {\"id\": 47, \"category\": \"موودك\", \"question\": \"اكتب إنجاز صغير فخور بيه الفترة دي\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Write a small achievement you feel proud of lately.\", \"options\": []}}, {\"id\": 48, \"category\": \"موودك\", \"question\": \"لو هتحتفل بأي حاجة النهاردة، هتحتفل بإيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"If you were celebrating something today, what would it be?\", \"options\": []}}, {\"id\": 49, \"category\": \"موودك\", \"question\": \"إيه نصيحة سمعتها وغيّرت فيك حاجة؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What piece of advice has changed you?\", \"options\": []}}, {\"id\": 50, \"category\": \"موودك\", \"question\": \"كلمة واحدة توصف مودك دلوقتي\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Describe your mood right now in one word.\", \"options\": []}}];\nlet bankCategory=bank[0].category;\nfunction renderBank(){const cats=[...new Set(bank.map(x=>x.category))];$('bankTabs').innerHTML=cats.map(c=>'<button class=\"secondary\" data-category=\"'+esc(c)+'\" aria-pressed=\"'+(c===bankCategory)+'\">'+esc(lang==='en'?bank.find(x=>x.category===c).en.category:c)+'</button>').join('');$('bankCategory').textContent=(lang==='en'?bank.find(x=>x.category===bankCategory).en.category:bankCategory)+t(\" · ١٠ أسئلة\");$('bankList').innerHTML=bank.filter(x=>x.category===bankCategory).map(x=>'<button class=\"bank-pick\" data-bank=\"'+x.id+'\"><b>'+x.id+'</b><span>'+esc(localBank(x).question)+'</span><small>'+(x.mode==='poll'?t(\"خيارين\"):t(\"مكتوبة\"))+'</small></button>').join('');for(const el of document.querySelectorAll('[data-category]'))el.onclick=()=>{bankCategory=el.dataset.category;renderBank()};for(const el of document.querySelectorAll('[data-bank]'))el.onclick=()=>{const x=localBank(bank.find(q=>q.id===Number(el.dataset.bank)));$('title').value=x.category;$('question').value=x.question;setMode(x.mode);setOptionCount(x.mode==='poll'?x.options.length:3);for(let i=0;i<3;i++)$('option'+i).value=x.options[i]||'';$('bankSelected').dataset.questionId=x.id;$('bankSelected').textContent=t(\"اتختار السؤال \")+x.id+t(\". راجع الحقول وعدّل قبل ما تبدأ.\");$('bankPanel').open=false;$('question').focus()}}\n$('openBank').onclick=()=>{show('setup');$('bankPanel').open=true;$('bankPanel').scrollIntoView({behavior:'smooth',block:'start'})};renderBank();\n$('startTrainer').onclick=()=>show('setup');$('resume').onclick=()=>startTrainer(saved());\n$('create').onclick=async()=>{const b=$('create');b.disabled=true;try{const durationSeconds=readDuration();const payload={durationSeconds,mode,identity,title:$('title').value.trim(),question:$('question').value.trim(),options:Array.from({length:optionCount},(_,i)=>i).map(i=>$('option'+i).value.trim())};if(!payload.title||!payload.question||(mode!=='text'&&payload.options.some(x=>!x)))throw new Error(t(\"كمّل عنوان السيشن والسؤال وكل الاختيارات.\"));if(mode==='ranking'){payload.hasCorrect=rankingCorrect;if(rankingCorrect){if($('correctChoice').value==='')throw new Error(t('اختار الإجابة الصحيحة من الاختيارات.'));payload.correctChoice=Number($('correctChoice').value);}if(pendingRanking)payload.rankingRound=pendingRanking;}const d=await api('/sessions',payload);pendingRanking=null;$('continuingRanking').classList.add('hidden');save(d);await startTrainer(d)}catch(e){error(e)}finally{b.disabled=false}};\nasync function startTrainer(info){if(!info)return;current=info;show('trainer');const u=location.origin+joinPath+'?code='+info.code+'&lang='+lang;$('sessionCode').textContent=info.code;for(const id of ['joinUrl','openJoin','qrLink'])$(id).href=u;$('joinUrl').textContent=u;$('qr').src=apiOrigin+'/qr?code='+info.code+'&lang='+lang+(pagesHost?'&frontend=pages':'');await refreshTrainer();timer=setInterval(()=>{if(!document.hidden)refreshTrainer()},5000)}\nasync function refreshTrainer(){try{const d=await api('/sessions/'+current.code+'/results',null,current.token);current={...current,...d};renderRanking(d);$('trainerTitle').textContent=d.title;$('resultQuestion').textContent=d.question;$('total').textContent=d.total;$('empty').classList.toggle('hidden',d.total>0);$('toggle').disabled=!!d.timeUp||!!d.roundEnded;$('pollStatus').textContent=d.timeUp?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):d.open?(d.mode==='text'?t(\"استقبال الردود مفتوح\"):t(\"التصويت مفتوح\")):(d.mode==='text'?t(\"استقبال الردود مقفول\"):t(\"التصويت مقفول\"));$('toggle').textContent=d.roundEnded?t('الجولة انتهت. ابدأ جولة جديدة.'):d.timeUp?t('الوقت خلص'):d.open?(d.mode==='text'?t(\"اقفل الردود\"):t(\"اقفل التصويت\")):(d.mode==='text'?t(\"افتح الردود\"):t(\"افتح التصويت\"));$('results').innerHTML=d.mode==='text'?d.answers.map((a,i)=>'<article class=\"written-answer\"><small dir=\"auto\">'+esc(d.identity==='named'?a.name||t(\"مشارك\"):t(\"رد \")+(d.total-i))+'</small><div dir=\"auto\">'+esc(a.answer)+'</div></article>').join(''):d.options.map((o,i)=>{const n=d.counts[i],p=d.total?Math.round(n/d.total*100):0;return '<div><div class=\"result-head\"><span>'+esc(o)+'</span><strong dir=\"ltr\">'+n+' · '+p+'%</strong></div><div class=\"track\"><div class=\"bar\" style=\"width:'+p+'%\"></div></div></div>'}).join('');$('namedPollSection').classList.toggle('hidden',d.identity!=='named'||d.mode==='text'||d.mode==='ranking');$('namedPollAnswers').innerHTML=(d.respondents||[]).map(a=>'<article class=\"written-answer\"><small dir=\"auto\">'+esc(a.name)+'</small><div>'+esc(d.options[a.choice])+'</div></article>').join('');$('connection').innerHTML='<span class=\"dot\"></span>'+t(\"متصل · آخر تحديث \")+new Date().toLocaleTimeString(lang==='en'?'en-GB':'ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('globalError').textContent='';updateCountdown()}catch(e){$('connection').textContent=t(\"التحديث متوقف مؤقتاً، بنحاول تاني\");error(e)}}\n$('toggle').onclick=async()=>{const b=$('toggle');b.disabled=true;try{await api('/sessions/'+current.code+'/status',{open:!current.open},current.token);await refreshTrainer()}catch(e){error(e)}finally{b.disabled=false}};\n$('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText($('joinUrl').href);$('copyJoin').textContent=t(\"اتنسخ الرابط\")}catch{$('copyJoin').textContent=t(\"انسخ الرابط المكتوب تحت الزر\")}};\n$('newSession').onclick=()=>{pendingRanking=null;$('continuingRanking').classList.add('hidden');$('newConfirm').classList.remove('hidden')};$('cancelNew').onclick=()=>$('newConfirm').classList.add('hidden');$('confirmNew').onclick=async()=>{try{await api('/sessions/'+current.code+(current.mode==='ranking'?'/finish':'/status'),current.mode==='ranking'?{}:{open:false},current.token);$('newConfirm').classList.add('hidden');show('setup')}catch(e){error(e)}};\n$('joinButton').onclick=join;$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')join()});\nasync function join(){const code=$('joinCode').value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));if(!/^\\d{6}$/.test(code)){error(new Error(t(\"اكتب كود السيشن المكوّن من ٦ أرقام.\")));return}$('joinButton').disabled=true;try{current=await api('/sessions/'+code+'?client='+encodeURIComponent(client()));selected=-1;try{$('participantName').value=sessionStorage.getItem('hall.name')||''}catch{}$('writtenAnswer').value='';$('charCount').textContent='0';show('participant');renderParticipant();timer=setInterval(()=>{if(!document.hidden)refreshParticipant()},5000)}catch(e){error(e)}finally{$('joinButton').disabled=false}}\nfunction renderParticipant(){if(timerRemaining()===0)current.open=false;const text=current.mode==='text',named=current.identity==='named',missingName=named&&!$('participantName').value.trim();$('nameEntry').classList.toggle('hidden',!named||current.voted);$('participantName').disabled=current.voted||sending;$('textPrivacy').textContent=named?t(\"ردك واسمك بيوصلوا للمدرب فقط.\"):t(\"ردك من غير اسم، وبيوصل للمدرب فقط.\");$('rankingParticipantInfo').classList.toggle('hidden',current.mode!=='ranking');$('rankingParticipantRule').textContent=t(current.hasCorrect?'رانكينج · أسرع إجابة صحيحة':'رانكينج · أسرع إجابة');for(const el of $('participant').querySelectorAll('[data-normal-only]'))el.classList.toggle('hidden',current.mode==='ranking');$('answerType').textContent=current.mode==='ranking'?t(current.hasCorrect?'رانكينج · أسرع إجابة صحيحة':'رانكينج · أسرع إجابة'):text?t(\"سؤال مفتوح · إجابة مكتوبة\"):t(\"تصويت سريع · اختيار واحد\");$('choices').classList.toggle('hidden',text);$('textEntry').classList.toggle('hidden',!text);$('writtenAnswer').disabled=!current.open||current.voted||sending;$('participantTitle').textContent=current.title;$('participantQuestion').textContent=current.question;$('choices').innerHTML=current.options.map((o,i)=>'<button class=\"choice '+(selected===i?'selected':'')+'\" data-choice=\"'+i+'\" aria-pressed=\"'+(selected===i)+'\" '+((!current.open||current.voted||sending)?'disabled':'')+'><span class=\"number\">'+(i+1)+'</span><span class=\"answer\" dir=\"auto\">'+esc(o)+'</span><span aria-hidden=\"true\">'+(selected===i?'✓':'○')+'</span></button>').join('');for(const el of document.querySelectorAll('[data-choice]'))el.onclick=()=>{selected=Number(el.dataset.choice);renderParticipant()};$('vote').textContent=text?t(\"ابعث إجابتي\"):t(\"ثبّت إجابتي\");$('vote').disabled=(text?!$('writtenAnswer').value.trim():selected<0)||missingName||!current.open||current.voted||sending;$('vote').classList.toggle('hidden',current.voted);$('voteStatus').classList.toggle('hidden',!current.voted&&current.open);$('voteStatus').textContent=current.timeUp&&!current.voted?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):current.voted?t(\"اتسجّل ردك ووصل للمدرب. شكراً لمشاركتك.\"):t(\"المدرب قفل استقبال الردود. لو فتحه تاني هتقدر تشارك.\");updateCountdown();$('participantConnection').textContent=current.timeUp?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):current.open?t(\"متصل · استقبال الردود مفتوح\"):t(\"متصل · استقبال الردود مقفول\")}\nasync function refreshParticipant(){try{current=await api('/sessions/'+current.code+'?client='+encodeURIComponent(client()));renderParticipant();$('globalError').textContent=''}catch(e){$('participantConnection').textContent=t(\"تعذّر تحديث حالة السيشن\");$('vote').disabled=true;error(e)}}\n$('vote').onclick=async()=>{if((current.mode==='text'?!$('writtenAnswer').value.trim():selected<0)||(current.identity==='named'&&!$('participantName').value.trim())||sending)return;sending=true;renderParticipant();try{await api('/sessions/'+current.code+'/vote',{client:client(),name:current.identity==='named'?$('participantName').value:undefined,choice:selected,answer:current.mode==='text'?$('writtenAnswer').value.trim():undefined});await refreshParticipant()}catch(e){error(e);await refreshParticipant()}finally{sending=false;renderParticipant()}};\nwindow.addEventListener('online',()=>{if(role==='trainer'){renderRanking(current);refreshTrainer()};if(role==='participant')refreshParticipant()});\n\nlet timerEnabled=false,expiredCountdownKey='';\nfunction setTimer(v){timerEnabled=v;$('timerOff').setAttribute('aria-pressed',String(!v));$('timerOn').setAttribute('aria-pressed',String(v));$('timerDuration').classList.toggle('hidden',!v)}\nfunction readDuration(){if(!timerEnabled)return 0;const m=$('timerMinutes').value.trim(),s=$('timerSeconds').value.trim();if(!/^\\d+$/.test(m)||!/^\\d+$/.test(s)||Number(m)>1439||Number(s)>59||Number(m)*60+Number(s)<1)throw new Error(t('اكتب الدقائق من ٠ لحد ١٤٣٩ والثواني من ٠ لحد ٥٩. المدة لازم تكون ثانية على الأقل.'));return Number(m)*60+Number(s)}\nfunction timerRemaining(){if(!current?.endsAt)return null;return Math.max(0,Math.ceil((current.endsAt-(current.serverNow+(performance.now()-(current.receivedAt??performance.now()))))/1000))}\nfunction updateCountdown(){const left=timerRemaining();for(const [id,view] of [['trainerCountdown','trainer'],['participantCountdown','participant']]){const el=$(id),visible=role===view&&left!==null;el.classList.toggle('hidden',!visible);if(!visible)continue;el.querySelector('.countdown-label').textContent=t(left===0?'الوقت خلص':'الوقت المتبقي');el.querySelector('.countdown-value').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');el.classList.toggle('urgent',left>0&&left<=10);el.classList.toggle('expired',left===0);const note=el.querySelector('.countdown-note');note.classList.toggle('hidden',left!==0);note.textContent=t('الوقت خلص. استقبال الردود اتقفل تلقائياً.')}if(left===0&&current){current.open=false;current.timeUp=true;const key=current.code+':'+current.endsAt;if(expiredCountdownKey!==key){expiredCountdownKey=key;if(role==='participant')queueMicrotask(()=>{renderParticipant();refreshParticipant()});if(role==='trainer'){ $('toggle').disabled=true;$('toggle').textContent=t('الوقت خلص');$('pollStatus').textContent=t('الوقت خلص. استقبال الردود اتقفل تلقائياً.');queueMicrotask(refreshTrainer)}}}}\n$('timerOff').onclick=()=>setTimer(false);$('timerOn').onclick=()=>setTimer(true);setInterval(updateCountdown,200);\n\nlet theme='light';try{theme=localStorage.getItem('roompulse.theme')||'light'}catch{}if(!['light','dark'].includes(theme))theme='light';\nfunction applyTheme(){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='dark'?'dark':'light';const b=document.getElementById('themeToggle');if(b){b.setAttribute('aria-pressed',String(theme==='dark'));b.setAttribute('aria-label',t('تغيير المظهر'));document.getElementById('themeLabel').textContent=t(theme==='dark'?'الوضع الفاتح':'الوضع الداكن')}}\nfunction toggleTheme(){theme=theme==='dark'?'light':'dark';try{localStorage.setItem('roompulse.theme',theme)}catch{}applyTheme()}\n$('themeToggle').onclick=()=>{toggleTheme();drawWheel()};applyTheme();\n\nlet rankingCorrect=false,pendingRanking=null;\nfunction setRankingCorrect(v){rankingCorrect=v;$('rankingHasCorrect').setAttribute('aria-pressed',String(v));$('rankingNoCorrect').setAttribute('aria-pressed',String(!v));$('correctChoiceBox').classList.toggle('hidden',!v)}\n$('rankingHasCorrect').onclick=()=>setRankingCorrect(true);$('rankingNoCorrect').onclick=()=>setRankingCorrect(false);\n$('separateRanking').onclick=()=>{pendingRanking=null;$('continuingRanking').classList.add('hidden')};\nfunction rankingRows(rows,round=false){return rows.map(a=>'<article class=\"ranking-row\"><div class=\"ranking-place\">'+a.rank+'</div><div><strong dir=\"auto\">'+esc(a.name||t('مشارك ')+a.participant)+'</strong><small>'+esc(round?a.correctAnswers+' '+t('إجابات مؤهلة'):(a.elapsedMs/1000).toFixed(3)+' '+t('ثانية'))+'</small></div><div class=\"ranking-points\">'+a.points+'<small>'+t('نقطة')+'</small></div></article>').join('')}\nfunction renderRanking(d){if(!d)return;const is=d.mode==='ranking';$('rankingResults').classList.toggle('hidden',!is);$('results').classList.toggle('hidden',is);for(const el of $('trainer').querySelectorAll('[data-normal-only]'))el.classList.toggle('hidden',is);$('newSession').textContent=t(is?'جولة جديدة':'سيشن جديد');if(!is)return;$('rankingHint').textContent=d.roundEnded?t('الجولة خلصت. السكور النهائي ظاهر تحت.'):!d.rankingReady?t('اقفل الردود أو استنى المؤقت يخلص عشان يظهر ترتيب السؤال.'):(d.leaderboard?.length?'':t('مفيش إجابات مؤهلة للترتيب لسه.'));$('rankingList').innerHTML=rankingRows(d.leaderboard||[]);$('roundResults').classList.toggle('hidden',!d.roundEnded);$('roundList').innerHTML=rankingRows(d.roundLeaderboard||[],true);$('nextRanking').classList.toggle('hidden',!!d.roundEnded);$('finishRanking').classList.toggle('hidden',!!d.roundEnded);$('newSession').textContent=t('جولة جديدة');}\n$('nextRanking').onclick=async()=>{try{await api('/sessions/'+current.code+'/status',{open:false},current.token);pendingRanking={code:current.code,token:current.token};$('continuingRanking').classList.remove('hidden');$('question').value='';for(let i=0;i<3;i++)$('option'+i).value='';$('correctChoice').value='';$('bankSelected').textContent='';delete $('bankSelected').dataset.questionId;setMode('ranking');setIdentity(current.identity);show('setup')}catch(e){error(e)}};\n$('finishRanking').onclick=async()=>{if(!confirm(t('إنهاء الجولة يقفل كل أسئلتها نهائياً. متأكد؟')))return;const b=$('finishRanking');b.disabled=true;try{await api('/sessions/'+current.code+'/finish',{},current.token);await refreshTrainer()}catch(e){error(e)}finally{b.disabled=false}};\n\nlet wheelItems=[],wheelRotation=0,wheelSpinning=false,wheelWinner=null,wheelFrame=null;\nfunction wheelEntries(){return $('wheelEntries').value.split(/\\r?\\n/).map(s=>s.trim()).filter(Boolean)}\nfunction validateWheel(items){if(items.length<2)throw new Error(t('اكتب عنصرين على الأقل، كل عنصر في سطر.'));if(items.length>200)throw new Error(t('الحد الأقصى ٢٠٠ عنصر في اللفة.'));if(items.some(x=>x.length>100))throw new Error(t('كل عنصر لحد ١٠٠ حرف.'));}\nfunction wheelChanged(){if(wheelSpinning)return;wheelItems=wheelEntries();wheelWinner=null;$('wheelWinner').textContent='';$('wheelResult').classList.add('hidden');$('wheelCount').textContent=wheelItems.length+' '+t('عنصر');$('wheelSpin').disabled=wheelItems.length<2||wheelItems.length>200||wheelItems.some(x=>x.length>100);wheelRotation=0;drawWheel();}\nfunction wheelColor(i,n){const dark=theme==='dark';const colors=dark?['#E60000','#7F1D1D','#DA6B6B','#572C32','#9D3945','#BD5B40']:['#E60000','#FBE4E4','#EF8F8F','#8B1515','#F4B8AD','#BA4B4B'];return colors[i%colors.length]}\nfunction wheelRandomIndex(n){const bound=Math.floor(4294967296/n)*n;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=bound);return x%n}\nfunction drawWheel(){const canvas=$('wheelCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),size=720,c=size/2,R=316,dark=theme==='dark';canvas.width=size;canvas.height=size;ctx.clearRect(0,0,size,size);const n=wheelItems.length,items=n?wheelItems:[t('أضف العناصر')],step=Math.PI*2/items.length;\n ctx.save();ctx.translate(c,c);ctx.beginPath();ctx.arc(0,0,352,0,7);ctx.fillStyle=dark?'#1b1013':'#2a171b';ctx.fill();for(let i=0;i<48;i++){ctx.beginPath();ctx.arc(Math.cos(i*Math.PI/24)*335,Math.sin(i*Math.PI/24)*335,3.2,0,7);ctx.fillStyle=i%6?'#ffffff55':'#ff4a55';ctx.fill()}\n const PAL=['#e60000','#c4001a','#a80018','#d8101c','#b50016','#ee2a2a','#9c0014','#cf0a1c'];\n ctx.rotate(wheelRotation-Math.PI/2);items.forEach((item,i)=>{const a=i*step;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,a,a+step);ctx.closePath();if(n){const g=ctx.createRadialGradient(0,0,40,0,0,R);g.addColorStop(0,'#7d0012');g.addColorStop(1,PAL[i%PAL.length]);ctx.fillStyle=g}else ctx.fillStyle=dark?'#3a2227':'#fbe4e4';ctx.fill();ctx.lineWidth=n?3:2;ctx.strokeStyle=n?'#ffffff90':(dark?'#ffffff25':'#f0b7bd');ctx.stroke()});ctx.restore();\n if(items.length<=40){const fs=items.length>20?17:items.length>12?22:28,maxw=R*.66;items.forEach((item,i)=>{const th=wheelRotation-Math.PI/2+i*step+step/2,flip=Math.cos(th)<0;ctx.save();ctx.translate(c,c);ctx.rotate(th);if(flip){ctx.rotate(Math.PI);ctx.textAlign='left';ctx.translate(-R*.94,0)}else{ctx.textAlign='right';ctx.translate(R*.94,0)}ctx.textBaseline='middle';ctx.font='700 '+fs+'px Arial, sans-serif';ctx.fillStyle=n?'#fff':(dark?'#f6edf0':'#6b5960');let label=item;while(ctx.measureText(label).width>maxw&&label.length>1)label=label.slice(0,-2);if(label!==item)label+='…';ctx.fillText(label,0,0);ctx.restore()})}\n ctx.save();ctx.translate(c,c);ctx.beginPath();ctx.arc(0,0,46,0,7);ctx.fillStyle=dark?'#201317':'#fff';ctx.shadowColor='#0004';ctx.shadowBlur=16;ctx.shadowOffsetY=5;ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=6;ctx.strokeStyle='#E60000';ctx.stroke();ctx.fillStyle='#E60000';ctx.font='900 22px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('RP',0,1);ctx.restore();\n ctx.save();ctx.translate(c,6);ctx.beginPath();ctx.moveTo(-22,0);ctx.quadraticCurveTo(-22,24,0,60);ctx.quadraticCurveTo(22,24,22,0);ctx.quadraticCurveTo(0,-12,-22,0);ctx.closePath();ctx.fillStyle='#fff';ctx.shadowColor='#0005';ctx.shadowBlur=10;ctx.shadowOffsetY=4;ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=4;ctx.strokeStyle='#E60000';ctx.stroke();ctx.restore();\n canvas.setAttribute('aria-label',t('عجلة اختيار عشوائي')+' · '+wheelItems.length+' '+t('عنصر'))}\nfunction openWheel(){show('wheel');wheelChanged()}\nfunction renderWheelLanguage(){if(!$('wheelCanvas'))return;$('wheelCount').textContent=wheelItems.length+' '+t('عنصر');$('wheelSpin').textContent=t(wheelSpinning?'بتلف…':'لف العجلة');if(wheelWinner!==null)$('wheelWinner').textContent=wheelItems[wheelWinner];drawWheel()}\nasync function spinWheel(){if(wheelSpinning)return;try{wheelItems=wheelEntries();validateWheel(wheelItems)}catch(e){error(e);return}wheelSpinning=true;wheelWinner=null;$('wheelEntries').disabled=true;$('wheelSpin').disabled=true;$('wheelClear').disabled=true;$('wheelResult').classList.add('hidden');$('wheelSpin').textContent=t('بتلف…');$('globalError').textContent='';const index=wheelRandomIndex(wheelItems.length),step=Math.PI*2/wheelItems.length,base=wheelRotation,normalized=((base%(Math.PI*2))+Math.PI*2)%(Math.PI*2),target=2*Math.PI-(index+.5)*step,delta=6*Math.PI+((target-normalized+2*Math.PI)%(2*Math.PI)),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduce?0:4200,start=performance.now();const finish=()=>{wheelRotation=base+delta;wheelWinner=index;wheelSpinning=false;$('wheelEntries').disabled=false;$('wheelSpin').disabled=false;$('wheelClear').disabled=false;$('wheelSpin').textContent=t('لف العجلة');$('wheelWinner').textContent=wheelItems[index];$('wheelResult').classList.remove('hidden');drawWheel()};if(!duration){finish();return}await new Promise(resolve=>{const frame=now=>{const p=Math.min(1,(now-start)/duration);wheelRotation=base+delta*(1-Math.pow(1-p,4));drawWheel();if(p<1)wheelFrame=requestAnimationFrame(frame);else{finish();resolve()}};wheelFrame=requestAnimationFrame(frame)});}\n$('wheelTab').onclick=openWheel;$('openWheel').onclick=openWheel;$('activitiesTab').onclick=()=>show('welcome');$('wheelEntries').oninput=wheelChanged;$('wheelSpin').onclick=spinWheel;$('wheelClear').onclick=()=>{if(wheelSpinning)return;if(!$('wheelEntries').value||confirm(t('تمسح كل عناصر العجلة؟'))){$('wheelEntries').value='';wheelChanged()}};\n\nconst QAV_SYMBOLS=\"<symbol id=\\\"qa0\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><circle cx=\\\"15\\\" cy=\\\"16\\\" r=\\\"8\\\" fill=\\\"#222\\\"/><circle cx=\\\"49\\\" cy=\\\"16\\\" r=\\\"8\\\" fill=\\\"#222\\\"/><circle cx=\\\"32\\\" cy=\\\"35\\\" r=\\\"22\\\" fill=\\\"#fff\\\" stroke=\\\"#e5d3d6\\\"/><ellipse cx=\\\"22\\\" cy=\\\"32\\\" rx=\\\"6\\\" ry=\\\"8\\\" fill=\\\"#222\\\" transform=\\\"rotate(20 22 32)\\\"/><ellipse cx=\\\"42\\\" cy=\\\"32\\\" rx=\\\"6\\\" ry=\\\"8\\\" fill=\\\"#222\\\" transform=\\\"rotate(-20 42 32)\\\"/><circle cx=\\\"23\\\" cy=\\\"32\\\" r=\\\"2.2\\\" fill=\\\"#fff\\\"/><circle cx=\\\"23.8\\\" cy=\\\"31.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"41\\\" cy=\\\"32\\\" r=\\\"2.2\\\" fill=\\\"#fff\\\"/><circle cx=\\\"41.8\\\" cy=\\\"31.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><ellipse cx=\\\"32\\\" cy=\\\"41\\\" rx=\\\"4\\\" ry=\\\"3\\\" fill=\\\"#222\\\"/><path d=\\\"M28 46q4 3 8 0\\\" stroke=\\\"#222\\\" fill=\\\"none\\\" stroke-width=\\\"1.6\\\" stroke-linecap=\\\"round\\\"/></symbol><symbol id=\\\"qa1\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><path d=\\\"M14 44c0-14 8-24 20-24 10 0 16 6 16 14v10z\\\" fill=\\\"#4cc38a\\\"/><path d=\\\"M20 22l3-6 3 6M30 19l3-6 3 6M40 22l3-6 3 6\\\" fill=\\\"#2f9a68\\\"/><circle cx=\\\"40\\\" cy=\\\"30\\\" r=\\\"3\\\" fill=\\\"#fff\\\"/><circle cx=\\\"41\\\" cy=\\\"30\\\" r=\\\"1.6\\\" fill=\\\"#222\\\"/><path d=\\\"M38 40q5 4 10 0\\\" stroke=\\\"#1d6b47\\\" fill=\\\"none\\\" stroke-width=\\\"2\\\" stroke-linecap=\\\"round\\\"/><circle cx=\\\"46\\\" cy=\\\"35\\\" r=\\\"1\\\" fill=\\\"#2f9a68\\\"/></symbol><symbol id=\\\"qa2\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><path d=\\\"M12 28l4-16 12 8zM52 28l-4-16-12 8z\\\" fill=\\\"#ffb066\\\"/><circle cx=\\\"32\\\" cy=\\\"36\\\" r=\\\"20\\\" fill=\\\"#ffb066\\\"/><path d=\\\"M26 22l2 5M32 20v6M38 22l-2 5\\\" stroke=\\\"#e58a3a\\\" stroke-width=\\\"2\\\" stroke-linecap=\\\"round\\\"/><circle cx=\\\"24\\\" cy=\\\"34\\\" r=\\\"2.6\\\" fill=\\\"#222\\\"/><circle cx=\\\"24.8\\\" cy=\\\"33.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"40\\\" cy=\\\"34\\\" r=\\\"2.6\\\" fill=\\\"#222\\\"/><circle cx=\\\"40.8\\\" cy=\\\"33.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><path d=\\\"M30 40h4l-2 3z\\\" fill=\\\"#E60000\\\"/><path d=\\\"M32 43q-3 4-7 2M32 43q3 4 7 2\\\" stroke=\\\"#222\\\" fill=\\\"none\\\" stroke-width=\\\"1.5\\\" stroke-linecap=\\\"round\\\"/><path d=\\\"M8 38h10M8 43l10-2M56 38H46M56 43l-10-2\\\" stroke=\\\"#222\\\" stroke-width=\\\"1\\\" opacity=\\\".5\\\"/></symbol><symbol id=\\\"qa3\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><path d=\\\"M10 14l14 10-6 18zM54 14L40 24l6 18z\\\" fill=\\\"#f0782a\\\"/><path d=\\\"M12 30q20-14 40 0l-8 22q-12 8-24 0z\\\" fill=\\\"#f0782a\\\"/><path d=\\\"M20 38q12 4 24 0l-6 14h-12z\\\" fill=\\\"#fff\\\"/><circle cx=\\\"24\\\" cy=\\\"34\\\" r=\\\"2.4\\\" fill=\\\"#222\\\"/><circle cx=\\\"24.8\\\" cy=\\\"33.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"40\\\" cy=\\\"34\\\" r=\\\"2.4\\\" fill=\\\"#222\\\"/><circle cx=\\\"40.8\\\" cy=\\\"33.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"32\\\" cy=\\\"48\\\" r=\\\"2.4\\\" fill=\\\"#222\\\"/></symbol><symbol id=\\\"qa4\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><circle cx=\\\"20\\\" cy=\\\"22\\\" r=\\\"9\\\" fill=\\\"#6bd16b\\\"/><circle cx=\\\"44\\\" cy=\\\"22\\\" r=\\\"9\\\" fill=\\\"#6bd16b\\\"/><ellipse cx=\\\"32\\\" cy=\\\"38\\\" rx=\\\"22\\\" ry=\\\"17\\\" fill=\\\"#6bd16b\\\"/><circle cx=\\\"20\\\" cy=\\\"22\\\" r=\\\"4\\\" fill=\\\"#222\\\"/><circle cx=\\\"20.8\\\" cy=\\\"21.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"44\\\" cy=\\\"22\\\" r=\\\"4\\\" fill=\\\"#222\\\"/><circle cx=\\\"44.8\\\" cy=\\\"21.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><path d=\\\"M18 40q14 12 28 0\\\" stroke=\\\"#256b25\\\" fill=\\\"none\\\" stroke-width=\\\"2.4\\\" stroke-linecap=\\\"round\\\"/><circle cx=\\\"28\\\" cy=\\\"33\\\" r=\\\"1\\\" fill=\\\"#256b25\\\"/><circle cx=\\\"36\\\" cy=\\\"33\\\" r=\\\"1\\\" fill=\\\"#256b25\\\"/><circle cx=\\\"16\\\" cy=\\\"40\\\" r=\\\"3\\\" fill=\\\"#ff9aa2\\\" opacity=\\\".7\\\"/><circle cx=\\\"48\\\" cy=\\\"40\\\" r=\\\"3\\\" fill=\\\"#ff9aa2\\\" opacity=\\\".7\\\"/></symbol><symbol id=\\\"qa5\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><ellipse cx=\\\"32\\\" cy=\\\"36\\\" rx=\\\"18\\\" ry=\\\"22\\\" fill=\\\"#2b2b3a\\\"/><ellipse cx=\\\"32\\\" cy=\\\"41\\\" rx=\\\"12\\\" ry=\\\"16\\\" fill=\\\"#fff\\\"/><circle cx=\\\"26\\\" cy=\\\"28\\\" r=\\\"3\\\" fill=\\\"#fff\\\"/><circle cx=\\\"38\\\" cy=\\\"28\\\" r=\\\"3\\\" fill=\\\"#fff\\\"/><circle cx=\\\"26\\\" cy=\\\"28\\\" r=\\\"1.6\\\" fill=\\\"#222\\\"/><circle cx=\\\"26.8\\\" cy=\\\"27.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"38\\\" cy=\\\"28\\\" r=\\\"1.6\\\" fill=\\\"#222\\\"/><circle cx=\\\"38.8\\\" cy=\\\"27.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><path d=\\\"M28 33h8l-4 5z\\\" fill=\\\"#ffb02e\\\"/><path d=\\\"M14 40q-4 8 2 12M50 40q4 8-2 12\\\" stroke=\\\"#2b2b3a\\\" stroke-width=\\\"5\\\" fill=\\\"none\\\" stroke-linecap=\\\"round\\\"/><path d=\\\"M26 58h-4M42 58h4\\\" stroke=\\\"#ffb02e\\\" stroke-width=\\\"3\\\" stroke-linecap=\\\"round\\\"/></symbol><symbol id=\\\"qa6\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><ellipse cx=\\\"23\\\" cy=\\\"14\\\" rx=\\\"5\\\" ry=\\\"13\\\" fill=\\\"#fff\\\" stroke=\\\"#e5d3d6\\\"/><ellipse cx=\\\"41\\\" cy=\\\"14\\\" rx=\\\"5\\\" ry=\\\"13\\\" fill=\\\"#fff\\\" stroke=\\\"#e5d3d6\\\"/><ellipse cx=\\\"23\\\" cy=\\\"15\\\" rx=\\\"2.4\\\" ry=\\\"8\\\" fill=\\\"#ffb3bd\\\"/><ellipse cx=\\\"41\\\" cy=\\\"15\\\" rx=\\\"2.4\\\" ry=\\\"8\\\" fill=\\\"#ffb3bd\\\"/><circle cx=\\\"32\\\" cy=\\\"38\\\" r=\\\"18\\\" fill=\\\"#fff\\\" stroke=\\\"#e5d3d6\\\"/><circle cx=\\\"25\\\" cy=\\\"36\\\" r=\\\"2.2\\\" fill=\\\"#222\\\"/><circle cx=\\\"25.8\\\" cy=\\\"35.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"39\\\" cy=\\\"36\\\" r=\\\"2.2\\\" fill=\\\"#222\\\"/><circle cx=\\\"39.8\\\" cy=\\\"35.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><path d=\\\"M30 41h4l-2 2.4z\\\" fill=\\\"#ff7a8a\\\"/><path d=\\\"M32 43.5q-2 3-5 2M32 43.5q2 3 5 2\\\" stroke=\\\"#222\\\" fill=\\\"none\\\" stroke-width=\\\"1.3\\\" stroke-linecap=\\\"round\\\"/><circle cx=\\\"21\\\" cy=\\\"42\\\" r=\\\"3\\\" fill=\\\"#ffb3bd\\\" opacity=\\\".7\\\"/><circle cx=\\\"43\\\" cy=\\\"42\\\" r=\\\"3\\\" fill=\\\"#ffb3bd\\\" opacity=\\\".7\\\"/></symbol><symbol id=\\\"qa7\\\" viewBox=\\\"0 0 64 64\\\"><circle cx=\\\"32\\\" cy=\\\"32\\\" r=\\\"32\\\" fill=\\\"#fff1f2\\\"/><circle cx=\\\"32\\\" cy=\\\"34\\\" r=\\\"25\\\" fill=\\\"#c9742a\\\"/><g fill=\\\"#c9742a\\\"><circle cx=\\\"10\\\" cy=\\\"30\\\" r=\\\"6\\\"/><circle cx=\\\"54\\\" cy=\\\"30\\\" r=\\\"6\\\"/><circle cx=\\\"14\\\" cy=\\\"50\\\" r=\\\"6\\\"/><circle cx=\\\"50\\\" cy=\\\"50\\\" r=\\\"6\\\"/><circle cx=\\\"32\\\" cy=\\\"8\\\" r=\\\"6\\\"/></g><circle cx=\\\"32\\\" cy=\\\"36\\\" r=\\\"17\\\" fill=\\\"#ffc86b\\\"/><circle cx=\\\"18\\\" cy=\\\"22\\\" r=\\\"5\\\" fill=\\\"#ffc86b\\\"/><circle cx=\\\"46\\\" cy=\\\"22\\\" r=\\\"5\\\" fill=\\\"#ffc86b\\\"/><circle cx=\\\"25\\\" cy=\\\"33\\\" r=\\\"2.6\\\" fill=\\\"#222\\\"/><circle cx=\\\"25.8\\\" cy=\\\"32.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><circle cx=\\\"39\\\" cy=\\\"33\\\" r=\\\"2.6\\\" fill=\\\"#222\\\"/><circle cx=\\\"39.8\\\" cy=\\\"32.2\\\" r=\\\".9\\\" fill=\\\"#fff\\\"/><path d=\\\"M29 39h6l-3 3z\\\" fill=\\\"#7a3d12\\\"/><path d=\\\"M32 42q-3 5-7 3M32 42q3 5 7 3\\\" stroke=\\\"#7a3d12\\\" fill=\\\"none\\\" stroke-width=\\\"1.6\\\" stroke-linecap=\\\"round\\\"/></symbol>\";\nconst QS=(()=>{\nconst F=m=>440*Math.pow(2,(m-69)/12);\nfunction tone(c,d,type,f,t,dur,vol,f2){const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+Math.min(0.012,dur/3));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(d);o.start(t);o.stop(t+dur+0.05)}\nlet nb=null;function noiseBuf(c){if(!nb||nb.sampleRate!==c.sampleRate){nb=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const a=nb.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1}return nb}\nfunction noise(c,d,t,dur,vol,type,freq,q){const s=c.createBufferSource();s.buffer=noiseBuf(c);const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;const g=c.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(f);f.connect(g);g.connect(d);s.start(t,Math.random());s.stop(t+dur+0.05)}\nfunction kick(c,d,t,v){tone(c,d,'sine',150,t,0.18,v,45)}\n\nconst rv=new WeakMap();\nfunction reverb(c,d){if(rv.has(c))return rv.get(c);const len=c.sampleRate*1.6,b=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);for(let i=0;i<len;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}const cv=c.createConvolver();cv.buffer=b;const g=c.createGain();g.gain.value=0.5;cv.connect(g);g.connect(d);rv.set(c,cv);return cv}\nfunction voice(c,d,type,f,t,dur,vol,lp,det,f2){const g=c.createGain(),fl=c.createBiquadFilter();fl.type='lowpass';fl.frequency.value=lp||8000;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.012);g.gain.setValueAtTime(vol,t+Math.max(0.013,dur*0.6));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);fl.connect(g);g.connect(d);for(const dt of (det||[0])){const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);o.detune.value=dt;o.connect(fl);o.start(t);o.stop(t+dur+0.05)}}\nfunction snare(c,d,t,v){noise(c,d,t,0.16,v,'bandpass',2200,0.7);tone(c,d,'triangle',210,t,0.1,v*0.5,150)}\nfunction echo(c,d){const dl=c.createDelay(1),fb=c.createGain(),wet=c.createGain();dl.delayTime.value=0.38;fb.gain.value=0.3;wet.gain.value=0.3;dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(d);return dl}\nconst CH={arcade:{bpm:116,bars:8,chords:[[57,60,64,45],[53,57,60,41],[55,60,64,48],[55,59,62,43],[57,60,64,45],[53,57,60,41],[55,59,62,43],[55,60,64,48]],\n mel:[[76,0,72,0,76,79,0,76],[77,0,76,0,72,0,69,0],[79,0,76,0,72,0,76,79],[81,0,79,0,76,0,74,0],[76,0,72,0,76,79,0,81],[84,0,81,0,77,0,76,0],[79,0,0,74,79,0,83,0],[84,0,0,0,79,0,0,0]]},\n calm:{bpm:88,bars:6,chords:[[60,64,67,36],[57,60,64,33],[53,57,60,29],[55,59,62,31],[60,64,67,36],[55,59,62,31]]}};\nfunction music(c,d,style,t0){const S=CH[style]||CH.arcade,b=60/S.bpm,bar=4*b;\n if(style==='calm'){for(let k=0;k<S.bars;k++){const ch=S.chords[k%S.chords.length],t=t0+k*bar;\n   for(const n of ch.slice(0,3)){tone(c,d,'triangle',F(n),t,bar*1.05,0.05);tone(c,d,'sine',F(n-12),t,bar*1.05,0.05)}\n   tone(c,d,'sine',F(ch[3]),t,bar*0.98,0.16);\n   for(let i=0;i<8;i++){const n=ch[[0,1,2,1,0,2,1,2][i]]+12;tone(c,d,'sine',F(n),t+i*b/2,b*1.1,0.07);tone(c,d,'triangle',F(n+12),t+i*b/2,b*0.5,0.025)}\n   kick(c,d,t,0.28);kick(c,d,t+2*b,0.2);noise(c,d,t+b,0.12,0.05,'bandpass',2500,1);noise(c,d,t+3*b,0.12,0.05,'bandpass',2500,1)}\n  return S.bars*bar}\n const R=reverb(c,d),E=echo(c,d);const lead=c.createGain();lead.gain.value=1;lead.connect(d);lead.connect(E);lead.connect(R);\n for(let k=0;k<S.bars;k++){const ch=S.chords[k],t=t0+k*bar,m=S.mel[k];\n  // drums\n  for(let i=0;i<4;i++){kick(c,d,t+i*b,0.5);}\n  snare(c,d,t+b,0.22);snare(c,d,t+3*b,0.22);\n  for(let i=0;i<8;i++){noise(c,d,t+i*b/2+(i%2?0:0),i%2?0.09:0.04,i%2?0.07:0.05,'highpass',8000)}\n  // bass (saw, lowpassed, eighths with octave)\n  for(let i=0;i<8;i++)voice(c,d,'sawtooth',F(ch[3]+(i%4===3?12:0)),t+i*b/2,b/2*0.85,0.22,500);\n  // chord stabs (detuned saws), syncopated\n  for(const off of [0,1.5,2.5]){for(const n of ch.slice(0,3))voice(c,R,'sawtooth',F(n),t+off*b,b*0.45,0.035,2200,[-9,9]);voice(c,d,'sawtooth',F(ch[2]),t+off*b,b*0.4,0.02,1800,[-6,6])}\n  // lead melody (detuned saw + sine octave, filtered), echo and reverb\n  for(let i=0;i<8;i++)if(m[i])voice(c,lead,'sawtooth',F(m[i]),t+i*b/2,b*0.55,0.07,3200,[-7,7]),voice(c,lead,'sine',F(m[i]-12),t+i*b/2,b*0.55,0.05,3000)}\n return S.bars*bar}\nfunction ting(c,d,t){tone(c,d,'sine',1319,t,0.5,0.32);tone(c,d,'sine',1760,t+0.09,0.7,0.3);tone(c,d,'triangle',2637,t+0.09,0.4,0.06);tone(c,d,'sine',3520,t+0.09,0.5,0.05)}\n\nfunction buzz(c,d,t){const R=reverb(c,d);voice(c,d,'sine',392,t,0.28,0.16,2000);voice(c,d,'sine',293.7,t+0.2,0.45,0.15,2000);voice(c,R,'triangle',293.7,t+0.2,0.45,0.05,1500)}\nfunction cheer(c,d,t){const R=reverb(c,d);\n const bed=c.createBufferSource();bed.buffer=noiseBuf(c);const bf=c.createBiquadFilter();bf.type='bandpass';bf.frequency.value=900;bf.Q.value=0.6;const bg=c.createGain();bg.gain.setValueAtTime(0.0001,t);bg.gain.exponentialRampToValueAtTime(0.06,t+0.8);bg.gain.setValueAtTime(0.06,t+3.2);bg.gain.exponentialRampToValueAtTime(0.0001,t+5);bed.connect(bf);bf.connect(bg);bg.connect(d);bg.connect(R);bed.start(t);bed.stop(t+5.1);\n for(let i=0;i<700;i++){const x=Math.pow(Math.random(),0.9),at=t+x*4.6,env=Math.sin(Math.PI*Math.min(1,x*1.05));const v=(0.05+Math.random()*0.17)*(0.25+env);const dst=Math.random()<0.45?R:d;noise(c,dst,at,0.012+Math.random()*0.03,v,'bandpass',900+Math.random()*3800,0.9+Math.random()*1.2)}\n const w=c.createOscillator(),wg=c.createGain(),lf=c.createOscillator(),lg=c.createGain();w.type='sine';w.frequency.setValueAtTime(1900,t+1.0);w.frequency.exponentialRampToValueAtTime(2500,t+1.5);w.frequency.exponentialRampToValueAtTime(2300,t+2.0);lf.frequency.value=6;lg.gain.value=22;lf.connect(lg);lg.connect(w.frequency);wg.gain.setValueAtTime(0.0001,t+1.0);wg.gain.exponentialRampToValueAtTime(0.05,t+1.1);wg.gain.exponentialRampToValueAtTime(0.0001,t+2.0);w.connect(wg);wg.connect(d);wg.connect(R);w.start(t+1.0);lf.start(t+1.0);w.stop(t+2.05);lf.stop(t+2.05);\n for(let i=0;i<6;i++){const at=t+0.15+i*0.22;noise(c,d,at,0.1,0.1,'lowpass',2500);tone(c,R,'sine',500+Math.random()*500,at,0.08,0.03,250)}\n return 5}\n\nfunction kick2(c,d,t,v){tone(c,d,'sine',170,t,0.22,v,42);noise(c,d,t,0.02,v*0.3,'lowpass',3000)}\nfunction clap(c,d,t,v){for(let k=0;k<3;k++)noise(c,d,t+k*0.011,0.05,v,'bandpass',1500,1.2);noise(c,d,t+0.03,0.14,v*0.7,'bandpass',1400,0.9)}\nfunction mbar(c,d,V,k,t,R,E,lead){const b=60/V.bpm,bar=4*b;const ch=V.chords[k%4],root=V.roots[k%4],m=V.mel[k];\n  const intro=k===0;\n  // drums\n  for(let i=0;i<4;i++){if(V.kick==='four'||i%2===0)kick2(c,d,t+i*b,V.kv)}\n  if(V.snare){for(const i of [1,3]){snare(c,d,t+i*b,0.2);if(V.clap)clap(c,R,t+i*b,0.07)}}\n  for(let i=0;i<8;i++){noise(c,d,t+i*b/2,i%2?0.11:0.035,i%2?0.06:0.04,'highpass',8500)}\n  if(V.hat16)for(let i=0;i<16;i++)if(i%2)noise(c,d,t+i*b/4,0.03,0.025,'highpass',9500);\n  // bass\n  for(let i=0;i<8;i++){const o=V.bassPat[i];if(o===null)continue;voice(c,d,V.bassWave,F(root+o),t+i*b/2,b/2*0.8,V.bassVol,V.bassLP)}\n  // pad\n  if(V.pad)for(const n of ch)voice(c,R,'sawtooth',F(n),t,bar*0.98,V.pad,1400,[-10,10]);\n  // stabs\n  if(V.stabs)for(const off of V.stabs){for(const n of ch)voice(c,R,'sawtooth',F(n),t+off*b,b*0.4,0.03,2400,[-8,8])}\n  // arp\n  if(V.arp){const pat=V.arp;for(let i=0;i<16;i++){const n=ch[pat[i%pat.length]%ch.length]+12*Math.floor(pat[i%pat.length]/ch.length)+12;voice(c,E,V.arpWave,F(n),t+i*b/4,b/4*0.8,V.arpVol,V.arpLP)}}\n  // lead\n  for(let i=0;i<8;i++)if(m[i]){voice(c,lead,V.leadWave,F(m[i]),t+i*b/2,b*V.leadLen,V.leadVol,V.leadLP,[-7,7]);if(V.bell)voice(c,lead,'sine',F(m[i]+12),t+i*b/2,b*0.5,V.leadVol*0.4,5000)}\n}\nfunction msess(c,d){rv.delete(c);const R=reverb(c,d),E=echo(c,d);const lead=c.createGain();lead.gain.value=1;lead.connect(d);lead.connect(E);lead.connect(R);return {R,E,lead}}\nfunction music2(c,d,V){const b=60/V.bpm,bar=4*b,t0=0.05;const R=reverb(c,d),E=echo(c,d);\n const lead=c.createGain();lead.gain.value=1;lead.connect(d);lead.connect(E);lead.connect(R);\n for(let k=0;k<8;k++){const ch=V.chords[k%4],root=V.roots[k%4],t=t0+k*bar,m=V.mel[k];\n  const intro=k===0;\n  // drums\n  for(let i=0;i<4;i++){if(V.kick==='four'||i%2===0)kick2(c,d,t+i*b,V.kv)}\n  if(V.snare){for(const i of [1,3]){snare(c,d,t+i*b,0.2);if(V.clap)clap(c,R,t+i*b,0.07)}}\n  for(let i=0;i<8;i++){noise(c,d,t+i*b/2,i%2?0.11:0.035,i%2?0.06:0.04,'highpass',8500)}\n  if(V.hat16)for(let i=0;i<16;i++)if(i%2)noise(c,d,t+i*b/4,0.03,0.025,'highpass',9500);\n  // bass\n  for(let i=0;i<8;i++){const o=V.bassPat[i];if(o===null)continue;voice(c,d,V.bassWave,F(root+o),t+i*b/2,b/2*0.8,V.bassVol,V.bassLP)}\n  // pad\n  if(V.pad)for(const n of ch)voice(c,R,'sawtooth',F(n),t,bar*0.98,V.pad,1400,[-10,10]);\n  // stabs\n  if(V.stabs)for(const off of V.stabs){for(const n of ch)voice(c,R,'sawtooth',F(n),t+off*b,b*0.4,0.03,2400,[-8,8])}\n  // arp\n  if(V.arp){const pat=V.arp;for(let i=0;i<16;i++){const n=ch[pat[i%pat.length]%ch.length]+12*Math.floor(pat[i%pat.length]/ch.length)+12;voice(c,E,V.arpWave,F(n),t+i*b/4,b/4*0.8,V.arpVol,V.arpLP)}}\n  // lead\n  for(let i=0;i<8;i++)if(m[i]){voice(c,lead,V.leadWave,F(m[i]),t+i*b/2,b*V.leadLen,V.leadVol,V.leadLP,[-7,7]);if(V.bell)voice(c,lead,'sine',F(m[i]+12),t+i*b/2,b*0.5,V.leadVol*0.4,5000)}\n }\n return 8*bar}\nreturn {mbar,msess,music2,music,ting,buzz,cheer,CH}})();\n\n/* ===== QUIZ MODULE (client) ===== */\nObject.assign(EN,{\"رفع Excel أو CSV\":\"Upload Excel or CSV\",\"الملف هيحل محل الأسئلة الحالية. متأكد؟\":\"The file will replace the current questions. Sure?\",\"اختار شخصيتك\":\"Pick your character\",\"تحميل Excel\":\"Download Excel\",\n\"كويز\":\"Quiz\",\"مكتبة الكويزات\":\"Quiz library\",\"كويز جديد\":\"New quiz\",\"استيراد من ملف Excel (CSV)\":\"Import from Excel (CSV)\",\"قالب جاهز\":\"Template\",\"تغيير كلمة السر\":\"Change passcode\",\"خروج\":\"Log out\",\n\"أول مرة؟ اختار كلمة سر للصفحة دي. هتكتبها أنت هنا بنفسك، ومش هتتبعت في أي شات.\":\"First time here. Choose a passcode for this page. You type it yourself, it is never sent in chat.\",\n\"كلمة السر\":\"Passcode\",\"تأكيد كلمة السر\":\"Confirm passcode\",\"احفظ كلمة السر\":\"Save passcode\",\"ادخل\":\"Enter\",\"كلمتين السر مش زي بعض.\":\"The two passcodes do not match.\",\n\"ادخل كلمة السر عشان تفتح مكتبة الكويزات.\":\"Enter your passcode to open the quiz library.\",\"مفيش كويزات لسه. اعمل أول كويز.\":\"No quizzes yet. Create your first one.\",\n\"سؤال\":\"questions\",\"تشغيل\":\"Run\",\"تعديل\":\"Edit\",\"نسخ\":\"Duplicate\",\"حذف\":\"Delete\",\"تمسح الكويز ده نهائياً؟\":\"Delete this quiz permanently?\",\"آخر تعديل\":\"Last edited\",\n\"الكويزات بتتحفظ وتفضل موجودة لحد ما تمسحها.\":\"Quizzes are saved and stay until you delete them.\",\"عندك لعبة شغالة\":\"You have a game in progress\",\"ارجع للعبة\":\"Back to the game\",\n\"اسم الكويز\":\"Quiz name\",\"أضف سؤال\":\"Add a question\",\"اختيار من متعدد\":\"Multiple Choice\",\"اكتشف الغلطة\":\"Spot the Mistake\",\"سحابة كلمات\":\"Word Cloud\",\n\"نص السؤال\":\"Question text\",\"الموقف أو التعليمات\":\"Situation or instruction\",\"اختار الإجابة الصح\":\"Mark the correct answer\",\"اختار السطر الغلط\":\"Mark the mistake\",\"إضافة اختيار\":\"Add choice\",\"إضافة سطر\":\"Add line\",\n\"اختيار\":\"Choice\",\"سطر في المحادثة\":\"Chat line\",\"الوقت بالثواني\":\"Time (seconds)\",\"احذف السؤال\":\"Delete question\",\"فوق\":\"Up\",\"تحت\":\"Down\",\"احفظ الكويز\":\"Save quiz\",\"إلغاء\":\"Cancel\",\"تصدير CSV\":\"Export CSV\",\n\"اتحفظ الكويز.\":\"Quiz saved.\",\"اكتب اسم الكويز.\":\"Enter a quiz name.\",\"أضف سؤال واحد على الأقل.\":\"Add at least one question.\",\"اكتب نص كل سؤال.\":\"Write the text of every question.\",\"كمّل اختيارات كل سؤال.\":\"Complete the choices of every question.\",\"حدد الإجابة الصح في كل سؤال.\":\"Mark the correct answer in every question.\",\n\"الكل يكتب كلمة قصيرة وتظهر سحابة حية.\":\"Everyone types a short word and a live cloud appears.\",\"المتدرب يختار من موبايله، والنقاط بالسرعة.\":\"Players pick on their phones. Points reward speed.\",\"محادثة فيها غلطة، والمتدرب يختار السطر الغلط.\":\"A conversation with one mistake. Players pick the wrong line.\",\n\"شغّل الكويز\":\"Run the quiz\",\"كل واحد لوحده\":\"Everyone solo\",\"فرق\":\"Teams\",\"عدد الفرق\":\"Number of teams\",\"ابدأ اللوبي\":\"Open the lobby\",\"الكويز\":\"Quiz\",\n\"ادخل على الرابط واكتب الكود\":\"Open the link and enter the code\",\"أو امسح الـ QR\":\"or scan the QR\",\"انضموا\":\"joined\",\"نقاط كل الأسئلة\":\"Points for all questions\",\"طبّق على الكل\":\"Apply to all\",\"رجّع الكل لـ 1\":\"Reset all to 1\",\"إنهاء اللعبة\":\"End game\",\"تنهي اللعبة دلوقتي؟ هتتسجل في السجل.\":\"End the game now? It will be saved to History.\",\"استنى المتدربين يدخلوا…\":\"Waiting for players…\",\"ابدأ الكويز\":\"Start quiz\",\n\"أجاوبوا\":\"answered\",\"اعرض النتيجة دلوقتي\":\"Show results now\",\"السؤال التالي\":\"Next question\",\"اعرض النتيجة النهائية\":\"Show final results\",\"الإجابة الصح\":\"Correct answer\",\"الترتيب\":\"Leaderboard\",\"ترتيب الفرق\":\"Team standings\",\"الفريق\":\"Team\",\"نقطة\":\"pts\",\"عضو\":\"members\",\n\"النتيجة النهائية\":\"Final results\",\"تقرير الجلسة\":\"Session report\",\"صح\":\"correct\",\"محتاج مراجعة\":\"needs review\",\"اللي غلطوا\":\"Got it wrong\",\"ماجاوبوش\":\"No answer\",\"رجوع للمكتبة\":\"Back to library\",\"تصدير النتايج CSV\":\"Export results CSV\",\"جاري تجهيز التقرير…\":\"Preparing the report…\",\n\"اكتب اسمك\":\"Enter your name\",\"ادخل الكويز\":\"Join the quiz\",\"أنت جوّه. استنى المدرب يبدأ.\":\"You are in. Wait for the trainer to start.\",\"فريقك\":\"Your team\",\"اتسجلت إجابتك. استنى باقي القاعة…\":\"Answer locked in. Waiting for the room…\",\"ابعت\":\"Send\",\"اكتب كلمة\":\"Type a word\",\"ابعت الإجابة\":\"Send answer\",\n\"إجابة صح!\":\"Correct!\",\"الملف مش Excel صالح.\":\"This is not a valid Excel file.\",\"المتصفح ده مش بيفتح xlsx. احفظ الملف CSV.\":\"This browser cannot open xlsx. Save the file as CSV.\",\"استيراد من Excel (xlsx أو CSV)\":\"Import from Excel (xlsx or CSV)\",\"تحميل قالب Excel\":\"Download Excel template\",\"السجل\":\"History\",\"الطريقة: حمّل القالب، املاه (صف لكل سؤال)، وارفعه هنا من استيراد.\":\"How: download the template, fill it (one row per question), then upload it here with Import.\",\"لاعب\":\"players\",\"الأسئلة\":\"Questions\",\"تصدير الجدول CSV\":\"Export table CSV\",\"احذف من السجل\":\"Delete from history\",\"رجوع\":\"Back\",\"كل لعبة بتخلص بتتحفظ هنا لحد ما تمسحها.\":\"Every finished game is saved here until you delete it.\",\"تفاصيل\":\"Details\",\"احذف\":\"Delete\",\"لسه مفيش ألعاب مخلصة.\":\"No finished games yet.\",\"تمسح اللعبة دي من السجل نهائياً؟\":\"Delete this game from history permanently?\",\"أقصى نقاط للسؤال\":\"Max points for this question\",\"الإجابة الصح الأسرع بتاخد نقاط أكتر. الغلط بصفر.\":\"Faster correct answers earn more. Wrong answers get 0.\",\"شارك الرابط\":\"Share link\",\"انضم للكويز\":\"Join the quiz\",\"الكود\":\"Code\",\"اتنسخ الرابط والكود\":\"Link and code copied\",\"انسخ الرابط\":\"Copy the link\",\"إجابة غلط\":\"Wrong\",\"وقتك خلص\":\"Time is up\",\"نقاطك\":\"Your score\",\"مركزك\":\"Your rank\",\"ترتيب فريقك\":\"Your team rank\",\"الكويز خلص. شكراً على المشاركة!\":\"The quiz is over. Thanks for playing!\",\"استنى السؤال الجاي…\":\"Waiting for the next question…\",\"ما جاوبتش\":\"No answer\",\n\"الكود غير صحيح أو الكويز انتهى.\":\"The code is wrong or the quiz has ended.\",\"كلمة السر غلط.\":\"Wrong passcode.\",\"اكتب كلمة السر الأول.\":\"Enter the passcode first.\",\"الجلسة انتهت. ادخل كلمة السر تاني.\":\"Session expired. Enter the passcode again.\",\n\"كلمة السر من ٤ لـ ٦٤ حرف أو رقم.\":\"Passcode must be 4 to 64 characters.\",\"كلمة السر متحددة بالفعل. ادخل بيها.\":\"The passcode is already set. Enter it.\",\"محاولات كتير غلط. استنى ١٥ دقيقة وجرّب تاني.\":\"Too many wrong attempts. Wait 15 minutes and try again.\",\n\"الكويز مش موجود.\":\"Quiz not found.\",\"وصلت للحد الأقصى ١٠٠ كويز. امسح كويز قديم.\":\"Limit of 100 quizzes reached. Delete an old one.\",\"مفيش مشاركين لسه.\":\"No players yet.\",\"الكويز بدأ بالفعل.\":\"The quiz already started.\",\"السؤال ده مش مفتوح.\":\"This question is not open.\",\"الوقت خلص.\":\"Time is up.\",\"ادخل بالاسم الأول.\":\"Join with your name first.\",\n\"اكتب اسمك لحد ٤٠ حرف.\":\"Enter your name, up to 40 characters.\",\"وصلنا للحد الأقصى ٢٠٠ مشارك.\":\"Limit of 200 players reached.\",\"الكويز خلص.\":\"The quiz has ended.\",\"اكتب كلمة أو جملة قصيرة لحد ٣٠ حرف.\":\"Type a short word or phrase, up to 30 characters.\",\"اختيار غير صحيح.\":\"Invalid choice.\",\"شاشة المدرب دي مش متاحة من المتصفح الحالي.\":\"This trainer screen is not available from this browser.\",\n\"الملف مفيهوش أسئلة صالحة.\":\"The file has no valid questions.\",\"اتفتح الكويز من الملف. راجعه واحفظه.\":\"Quiz loaded from the file. Review it and save.\",\"الشعار\":\"Logo\"\n});\nconst Q={tok:null,view:'auth',lib:[],draft:null,draftId:null,launch:null,host:null,gs:null,off:0,pl:null,poll:null,sel:-1,report:null,sig:'',configured:null};\ntry{Q.tok=localStorage.getItem('quiz.admin')}catch{}\ntry{Q.host=JSON.parse(sessionStorage.getItem('quiz.host')||'null')}catch{}\nlet qapi=(p,b,tk)=>api('/quiz'+p,b,tk);\nconst qroot=()=>$(role==='quizPlay'?'quizPlayRoot':'quizRoot');\nconst SYM=['▲','◆','●','■','★','✚'];\nfunction qsetTok(v){Q.tok=v;try{v?localStorage.setItem('quiz.admin',v):localStorage.removeItem('quiz.admin')}catch{}}\nfunction qhostSave(){try{Q.host?sessionStorage.setItem('quiz.host',JSON.stringify(Q.host)):sessionStorage.removeItem('quiz.host')}catch{}}\nfunction qstop(){clearInterval(Q.poll);Q.poll=null;clearInterval(Q.hb);Q.hb=null;Q.wsOff=true;if(Q.ws){try{Q.ws.close()}catch{}Q.ws=null}}\nfunction qerr(e){if(/الجلسة انتهت/.test(e.message)&&Q.tok&&role==='quiz'){qsetTok(null);Q.view='auth'}error(e);}\nconst fmtp=n=>{n=Math.round((+n||0)*100)/100;return Number.isInteger(n)?String(n):n.toFixed(2).replace(/0$/,'')};\nfunction qrem(s){return Math.max(0,Math.ceil((s.qEnd-(Date.now()+Q.off))/1000))}\nfunction qnum(n){return String(n)}\nfunction qblank(type){return type==='cloud'?{type,text:'',time:30}:{type,text:'',options:type==='spot'?['','']:['','',''],correct:0,time:20,points:1}}\n/* ---------- host: open ---------- */\nasync function openQuiz(){show('quiz');Q.sig='';if(Q.host&&Q.view==='host'){startHostPoll();return}\n try{const st=await qapi('/admin/status');Q.configured=st.configured}catch(e){error(e);return}\n if(Q.tok){try{const l=await qapi('/library',null,Q.tok);Q.lib=l.quizzes;Q.view='lib'}catch(e){qsetTok(null);Q.view='auth'}}else Q.view='auth';\n qrender()}\nfunction qrender(){if(role!=='quiz')return;const r=$('quizRoot');\n if(Q.view==='auth')return authView(r);if(Q.view==='lib')return libView(r);if(Q.view==='edit')return editView(r);if(Q.view==='launch')return launchView(r);if(Q.view==='host')return hostView(r);if(Q.view==='hist')return histView(r);if(Q.view.startsWith('sys'))return sysRender(r)}\nfunction fmtDate(ts){try{return new Date(ts).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB')}catch{return''}}\nfunction typeName(x){return t(x==='mc'?'اختيار من متعدد':x==='spot'?'اكتشف الغلطة':'سحابة كلمات')}\nfunction libView(r){\n r.innerHTML=qtabs('lib')+'<div class=\"qrow between\"><h2>'+t('مكتبة الكويزات')+' ('+Q.lib.length+')</h2><button id=\"qnew\">+ '+t('كويز جديد')+'</button></div>'\n +(Q.host?'<div class=\"notice\"><p>'+t('عندك لعبة شغالة')+' · <bdi dir=\"ltr\">'+Q.host.code+'</bdi></p><div class=\"qrow\"><button class=\"secondary\" id=\"qresume\">'+t('ارجع للعبة')+'</button><button class=\"secondary qbtn-danger\" id=\"qendlib\">'+t('إنهاء اللعبة')+'</button></div></div>':'')\n +'<div id=\"qlist\">'+(Q.lib.length?Q.lib.map(x=>'<div class=\"qitem\" data-id=\"'+esc(x.id)+'\"><span><b dir=\"auto\">'+esc(x.title)+'</b><small>'+x.count+' '+t('سؤال')+' · '+x.types.map(typeName).join('، ')+' · '+t('آخر تعديل')+' '+fmtDate(x.updated)+'</small></span><span class=\"qrow\"><button data-a=\"run\">'+t('تشغيل')+'</button><button class=\"secondary\" data-a=\"edit\">'+t('تعديل')+'</button><button class=\"secondary\" data-a=\"dup\">'+t('نسخ')+'</button><button class=\"secondary\" data-a=\"xlsx\">Excel</button><button class=\"secondary\" data-a=\"csv\">CSV</button><button class=\"secondary qbtn-danger\" data-a=\"del\">'+t('حذف')+'</button></span></div>').join(''):'<p class=\"muted\">'+t('مفيش كويزات لسه. اعمل أول كويز.')+'</p>')+'</div>'\n +'<div class=\"qrow\" style=\"margin-top:18px\"><label class=\"btn secondary\" style=\"margin:0\">'+t('استيراد من Excel (xlsx أو CSV)')+'<input id=\"qfile\" type=\"file\" accept=\".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\" hidden></label><button class=\"secondary\" id=\"qtpl\">'+t('تحميل قالب Excel')+'</button><button class=\"secondary\" id=\"qout\">'+t('خروج')+'</button></div><p class=\"muted\">'+t('الكويزات بتتحفظ وتفضل موجودة لحد ما تمسحها.')+'</p><p class=\"muted\">'+t('الطريقة: حمّل القالب، املاه (صف لكل سؤال)، وارفعه هنا من استيراد.')+'</p>';\n $('qnew').onclick=()=>{Q.draft={title:'',questions:[qblank('mc')]};Q.draftId=null;Q.view='edit';qrender()};\n if($('qendlib'))$('qendlib').onclick=qendGame;if($('qresume'))$('qresume').onclick=()=>{Q.view='host';Q.sig='';startHostPoll()};\n $('qlist').onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;const id=b.closest('.qitem').dataset.id,a=b.dataset.a;try{\n  if(a==='del'){if(!confirm(t('تمسح الكويز ده نهائياً؟')))return;await qapi('/library/delete',{id},Q.tok);await qreloadLib();return}\n  const d=await qapi('/library/'+id,null,Q.tok);\n  if(a==='edit'){Q.draft=d.quiz;Q.draftId=id;Q.view='edit';qrender()}\n  else if(a==='dup'){const c={...d.quiz,title:d.quiz.title+' (2)'};await qapi('/library/save',{quiz:c},Q.tok);await qreloadLib()}\n  else if(a==='csv')qdownload(toCSV(d.quiz),d.quiz.title+'.csv');else if(a==='xlsx')qdlBlob(xlsxBuild(quizSheets(d.quiz)),(d.quiz.title||'quiz')+'.xlsx');\n  else if(a==='run'){Q.launch={id,title:d.quiz.title,teams:0};Q.view='launch';qrender()}}catch(er){qerr(er)}};\n $('qfile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const q=/\\.xlsx$/i.test(f.name)?fromRows(await xlsxRows(f)):fromCSV(await f.text());Q.draft=q;Q.draftId=null;Q.view='edit';qrender();$('globalError').textContent=''}catch(er){error(er)}};\n $('qtpl').onclick=()=>qdlBlob(xlsxBuild(qtemplateSheets()),'quiz-template.xlsx');\n $('qout').onclick=()=>{qsetTok(null);Q.team=null;Q.view='auth';qrender()};qtabsBind();\n}\nasync function qreloadLib(){const l=await qapi('/library',null,Q.tok);Q.lib=l.quizzes;Q.view='lib';qrender()}\n/* ---------- CSV ---------- */\nfunction qdownload(text,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\\ufeff'+text],{type:'text/csv;charset=utf-8'}));a.download=name.replace(/[\\\\/:*?\"<>|]/g,'_');document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}\nconst csvCell=v=>{v=String(v??'');return /[\",\\n;\\r]/.test(v)?'\"'+v.replace(/\"/g,'\"\"')+'\"':v};\nfunction toCSV(q){const rows=[['type','question','seconds','correct_number','option1','option2','option3','option4','option5','option6','max_points']];for(const x of q.questions)rows.push([x.type,x.text,x.time,x.options?x.correct+1:'',...Array.from({length:6},(_,k)=>(x.options||[])[k]||''),x.options?(x.points>100?1:(x.points||1)):'']);rows.push(['title',q.title]);return rows.map(r=>r.map(csvCell).join(',')).join('\\r\\n')}\nfunction parseCSV(text){text=text.replace(/^\\ufeff/,'');const first=text.split(/\\r?\\n/)[0]||'';const d=[',',';','\\t'].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='\"'){if(text[i+1]==='\"'){cell+='\"';i++}else q=false}else cell+=c}else if(c==='\"')q=true;else if(c===d){row.push(cell);cell=''}else if(c==='\\n'||c==='\\r'){if(c==='\\r'&&text[i+1]==='\\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}if(cell!==''||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(x=>x.trim()))}\nfunction fromCSV(text){return fromRows(parseCSV(text))}\nfunction fromRows(rows){if(rows.length&&/^type$/i.test(rows[0][0].trim()))rows.shift();const questions=[];let ttl='';for(const r of rows){const type=(r[0]||'').trim().toLowerCase();if(type==='title'){ttl=(r[1]||'').trim().slice(0,80);continue}if(!['mc','spot','cloud'].includes(type))continue;const tx=(r[1]||'').trim();if(!tx)continue;const time=Math.min(240,Math.max(5,parseInt(r[2])||20));if(type==='cloud'){questions.push({type,text:tx,time});continue}const opts=r.slice(4,4+(type==='mc'?4:6)).map(x=>x.trim()).filter(Boolean);const cor=(parseInt(r[3])||1)-1;if(opts.length<2||cor<0||cor>=opts.length)continue;questions.push({type,text:tx,options:opts,correct:cor,time,points:Math.min(100,Math.max(1,parseInt(r[10])||1))})}if(!questions.length)throw new Error(t('الملف مفيهوش أسئلة صالحة.'));return {title:ttl,questions:questions.slice(0,50)}}\n\n/* ---------- xlsx reader (no libraries; uses the browser's built-in inflate) ---------- */\nasync function xlsxRows(file){const buf=new Uint8Array(await file.arrayBuffer()),dv=new DataView(buf.buffer);let e=buf.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error(t('الملف مش Excel صالح.'));\n const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const F={};for(let i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;const nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true);F[new TextDecoder().decode(buf.subarray(p+46,p+46+nl))]={m:dv.getUint16(p+10,true),c:dv.getUint32(p+20,true),o:dv.getUint32(p+42,true)};p+=46+nl+xl+cl}\n const rd=async nm=>{const f=F[nm];if(!f)return null;const o=f.o+30+dv.getUint16(f.o+26,true)+dv.getUint16(f.o+28,true),d=buf.subarray(o,o+f.c);if(f.m===0)return new TextDecoder().decode(d);if(f.m!==8||typeof DecompressionStream==='undefined')throw new Error(t('المتصفح ده مش بيفتح xlsx. احفظ الملف CSV.'));return new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()};\n const X=s=>new DOMParser().parseFromString(s,'application/xml'),tx=el=>Array.from(el.getElementsByTagNameNS('*','t')).map(x=>x.textContent).join('');\n const ss=await rd('xl/sharedStrings.xml');const sst=ss?Array.from(X(ss).getElementsByTagNameNS('*','si')).map(tx):[];\n const sn=Object.keys(F).filter(k=>/^xl\\/worksheets\\/sheet\\d+\\.xml$/.test(k)).sort((a,b)=>parseInt(a.match(/\\d+/g).pop())-parseInt(b.match(/\\d+/g).pop()))[0];if(!sn)throw new Error(t('الملف مش Excel صالح.'));\n const rows=[];for(const rw of X(await rd(sn)).getElementsByTagNameNS('*','row')){const row=[];for(const c of rw.getElementsByTagNameNS('*','c')){const col=(c.getAttribute('r')||'').replace(/\\d+/g,'').split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1;if(col<0)continue;const ty=c.getAttribute('t'),v=c.getElementsByTagNameNS('*','v')[0];let val='';if(ty==='inlineStr')val=tx(c);else if(v)val=ty==='s'?(sst[+v.textContent]||''):v.textContent;while(row.length<col)row.push('');row[col]=val}rows.push(row.map(x=>x==null?'':String(x)))}\n return rows.filter(r=>r.some(x=>x.trim()))}\n\nfunction qdlBlob(bytes,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}\nconst QCRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();\nfunction qcrc(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=QCRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}\nfunction qzip(files){const enc=new TextEncoder(),parts=[],cd=[];let off=0;const u16=v=>[v&255,v>>8&255],u32=v=>[v&255,v>>8&255,v>>16&255,v>>>24&255];\n for(const [name,txt] of files){const nm=enc.encode(name),d=enc.encode(txt),crc=qcrc(d);const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0),...nm]);parts.push(lh,d);\n  cd.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off),...nm]));off+=lh.length+d.length}\n const cs=cd.reduce((a,b)=>a+b.length,0);const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(cd.length),...u16(cd.length),...u32(cs),...u32(off),...u16(0)]);\n const all=[...parts,...cd,end];const out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let p=0;for(const x of all){out.set(x,p);p+=x.length}return out}\nfunction xlsxBuild(sheets){const esc2=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]/g,'');\n const col=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};\n const sx=sh=>'<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetViews><sheetView workbookViewId=\"0\"'+(sh.rtl?' rightToLeft=\"1\"':'')+'>'+(sh.freeze?'<pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>':'')+'</sheetView></sheetViews><cols>'+(sh.widths||[]).map((w,i)=>'<col min=\"'+(i+1)+'\" max=\"'+(i+1)+'\" width=\"'+w+'\" customWidth=\"1\"/>').join('')+'</cols><sheetData>'+sh.rows.map((r,ri)=>'<row r=\"'+(ri+1)+'\">'+r.map((v,ci)=>{const st=(sh.styles&&sh.styles(ri,ci))||0,ref=col(ci)+(ri+1);if(v===''||v==null)return st?'<c r=\"'+ref+'\" s=\"'+st+'\"/>':'';return typeof v==='number'?'<c r=\"'+ref+'\" s=\"'+st+'\"><v>'+v+'</v></c>':'<c r=\"'+ref+'\" s=\"'+st+'\" t=\"inlineStr\"><is><t xml:space=\"preserve\">'+esc2(v)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>';\n const files=[['[Content_Types].xml','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>'+sheets.map((_,i)=>'<Override PartName=\"/xl/worksheets/sheet'+(i+1)+'.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>').join('')+'</Types>'],\n ['_rels/.rels','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>'],\n ['xl/workbook.xml','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>'+sheets.map((x,i)=>'<sheet name=\"'+esc2(x.name)+'\" sheetId=\"'+(i+1)+'\" r:id=\"rId'+(i+1)+'\"/>').join('')+'</sheets></workbook>'],\n ['xl/_rels/workbook.xml.rels','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">'+sheets.map((_,i)=>'<Relationship Id=\"rId'+(i+1)+'\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet'+(i+1)+'.xml\"/>').join('')+'<Relationship Id=\"rId'+(sheets.length+1)+'\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>'],\n ['xl/styles.xml','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><color rgb=\"FFFFFFFF\"/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts><fills count=\"4\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE60000\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFFDECEC\"/></patternFill></fill></fills><borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style=\"thin\"><color rgb=\"FFE5C4C4\"/></left><right style=\"thin\"><color rgb=\"FFE5C4C4\"/></right><top style=\"thin\"><color rgb=\"FFE5C4C4\"/></top><bottom style=\"thin\"><color rgb=\"FFE5C4C4\"/></bottom><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"5\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"><alignment wrapText=\"1\" vertical=\"center\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\"><alignment wrapText=\"1\" vertical=\"top\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFill=\"1\" applyBorder=\"1\"><alignment horizontal=\"center\" vertical=\"top\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"><alignment wrapText=\"1\" vertical=\"top\"/></xf></cellXfs></styleSheet>'],\n ...sheets.map((x,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sx(x)])];\n return qzip(files)}\nfunction quizSheets(q){const T=qtemplateSheets(),H=T[0].rows[0],rows=[H];for(const x of q.questions)rows.push([x.type,x.text,x.time,x.options?x.correct+1:'',...Array.from({length:6},(_,k)=>(x.options||[])[k]||''),x.options?(x.points>100?1:(x.points||1)):'']);rows.push(['title',q.title]);return [{...T[0],rows},T[1]]}\nfunction qtemplateSheets(){const H=['type','question','seconds','correct_number','option1','option2','option3','option4','option5','option6','max_points'];\n const rows=[H,\n  ['mc','عميل زعلان من التأخير. تعمل إيه الأول؟',20,1,'تسمعه للآخر','تقاطعه','تحوله لزميلك','','','',1],\n  ['mc','What is the capital of Egypt?',15,1,'Cairo','Alexandria','Giza','Aswan','','',2],\n  ['spot','فين الغلطة في المحادثة؟',20,2,'أهلاً بحضرتك','دي مش مشكلتي','هشوف الموضوع','','','',1],\n  ['cloud','كلمة واحدة تصف خدمة العملاء',30,'','','','','','','','']];\n while(rows.length<41)rows.push(['','','','','','','','','','','']);\n const info=[['RoomPulse Quiz template | قالب كويز رومبولس'],[''],\n  ['1) Sheet \"Questions\": one row = one question (up to 50). Delete the 4 example rows or overwrite them. | الشيت Questions: كل صف سؤال (لحد ٥٠). امسح الأمثلة أو اكتب فوقها.'],\n  ['2) type: mc = multiple choice, spot = spot the mistake, cloud = word cloud. | type: mc اختيار من متعدد، spot اكتشف الغلطة، cloud سحابة كلمات.'],\n  ['3) correct_number = the NUMBER of the correct option (1 = option1, 2 = option2 ...). Leave empty for cloud. | correct_number = رقم الإجابة الصح (1 يعني option1، 2 يعني option2 ...). سيبه فاضي في cloud.'],\n  ['4) Options: mc takes 2 to 4 options, spot takes 2 to 6. Leave unused option cells empty. | mc من ٢ لـ ٤ اختيارات، spot من ٢ لـ ٦. سيب الخانات الفاضية.'],\n  ['5) seconds = time for the question (5 to 240, default 20). max_points = the question\\'s top score (1 to 100, default 1); faster correct answers earn more. | seconds وقت السؤال (٥ لـ ٢٤٠). max_points أقصى نقاط للسؤال (١ لـ ١٠٠، الافتراضي ١). الصح بياخد النقطة + لحد نصها بونص سرعة. الأسرع في الإجابة الصح بياخد أكتر.'],\n  ['6) Save as .xlsx, then in the Quiz tab press Import and choose this file. | احفظ الملف .xlsx وبعدين من تبويب كويز اضغط استيراد واختار الملف.']];\n return [{name:'Questions',rows,widths:[8,48,10,15,22,22,22,22,14,14,12],freeze:true,styles:(r,c)=>r===0?1:(c===3||c===0||c===2||c===10)?3:2},{name:'Read me',rows:info,widths:[140],styles:(r)=>r===0?1:4}]}\nfunction qdt(ts){try{return new Date(ts).toLocaleString(lang==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'})}catch{return''}}\nfunction histView(r){const h=Q.hist||{games:[],total:0},o=Q.histOpen;\n if(o){const rp=o.report;r.innerHTML='<span class=\"eyebrow\">'+t('السجل')+'</span><h2 dir=\"auto\">'+esc(rp.title)+'</h2><p class=\"muted\">'+qdt(o.ended)+' · '+rp.players.length+' '+t('لاعب')+'</p><div class=\"qglass\"><h3>'+t('النتيجة النهائية')+'</h3><div class=\"qlb\">'+rp.players.map(p=>'<div class=\"r\"><span>'+p.rank+'. <bdi dir=\"auto\">'+esc(p.name)+'</bdi>'+(rp.teams?' <small class=\"qbadge\">'+t('الفريق')+' '+p.team+'</small>':'')+'</span><span>'+fmtp(p.score)+'</span></div>').join('')+'</div>'+(rp.teamBoard?'<h3>'+t('ترتيب الفرق')+'</h3><div class=\"qlb\">'+rp.teamBoard.map((x,i)=>'<div class=\"r\"><span>'+(i+1)+'. '+t('الفريق')+' '+x.team+' <small class=\"qbadge\">'+x.members+' '+t('عضو')+'</small></span><span>'+fmtp(x.score)+'</span></div>').join('')+'</div>':'')+'<h3>'+t('الأسئلة')+'</h3><div class=\"qlb\">'+rp.questions.map((q,i)=>'<div class=\"r\"><span>'+(i+1)+'. <bdi dir=\"auto\">'+esc(q.text)+'</bdi></span><span>'+(q.type==='cloud'?q.answered:q.pct+'%')+'</span></div>').join('')+'</div>'\n  +'<div class=\"actions\"><button id=\"hexp\">'+t('تصدير الجدول CSV')+'</button><button class=\"secondary qbtn-danger\" id=\"hdel\">'+t('احذف من السجل')+'</button><button class=\"secondary\" id=\"hback\">'+t('رجوع')+'</button></div></div>';\n  $('hexp').onclick=()=>qdownload(reportCSV(rp,o.ended),(rp.title||'results')+'-'+new Date(o.ended).toISOString().slice(0,16).replace(/[:T]/g,'-')+'.csv');\n  $('hdel').onclick=()=>qhdel(o.code);$('hback').onclick=()=>{Q.histOpen=null;qrender()};return}\n const cl=[...new Set(h.games.map(g=>g.cls).filter(Boolean))],fq=(Q.hq||'').toLowerCase(),fc=Q.hc||'',gl=h.games.filter(g=>(!fc||g.cls===fc)&&(!fq||(g.title+' '+g.cls).toLowerCase().includes(fq)));\n r.innerHTML=qtabs('hist')+'<div class=\"qrow between\"><h2>'+t('السجل')+' ('+h.total+')</h2><button class=\"secondary\" id=\"hall\">'+t('تصدير الكل Excel')+'</button></div><div class=\"qrow\" style=\"gap:10px\"><input id=\"hq\" placeholder=\"'+t('ابحث بالاسم')+'\" value=\"'+esc(Q.hq||'')+'\" style=\"flex:1\"><select id=\"hc\" style=\"font:inherit;padding:10px;border-radius:8px\"><option value=\"\">'+t('كل الفصول')+'</option>'+cl.map(c=>'<option '+(c===fc?'selected':'')+' value=\"'+esc(c)+'\">'+esc(c)+'</option>').join('')+'</select></div>'\n  +(gl.length?'<div id=\"hlist\">'+gl.map(g=>'<div class=\"qitem\" data-c=\"'+esc(g.code)+'\"><span><b dir=\"auto\">'+esc(g.title)+'</b><small>'+(g.cls?'<span class=\"qbadge\" dir=\"auto\">'+esc(g.cls)+'</span> · ':'')+qdt(g.ended)+' · '+g.players+' '+t('لاعب')+(g.teams?' · '+g.teams+' '+t('فرق'):'')+(g.top&&g.top[0]?' · 🥇 <bdi dir=\"auto\">'+esc(g.top[0].name)+'</bdi> '+fmtp(g.top[0].score):'')+'</small></span><span class=\"qrow\"><button class=\"secondary\" data-a=\"open\">'+t('تفاصيل')+'</button><button class=\"secondary\" data-a=\"csv\">CSV</button><button class=\"secondary qbtn-danger\" data-a=\"del\">'+t('احذف')+'</button></span></div>').join('')+'</div>':'<div class=\"qglass\"><p class=\"muted\">'+t('لسه مفيش ألعاب مخلصة.')+'</p></div>');\n\n qtabsBind();$('hq').oninput=e=>{Q.hq=e.target.value;qrender();const x=$('hq');x.focus();x.setSelectionRange(x.value.length,x.value.length)};$('hc').onchange=e=>{Q.hc=e.target.value;qrender()};\n $('hall').onclick=async()=>{try{const gs=[],sc=[['Date','Class','Quiz','Code','Players','Rank','Name','Team','Score']];for(const g of gl){const d=await qapi('/history/'+g.code,null,Q.tok);gs.push([qdt(g.ended),g.cls||'',g.title,g.code,g.players,g.top&&g.top[0]?g.top[0].name:'',g.top&&g.top[0]?g.top[0].score:'']);for(const p of d.report.players)sc.push([qdt(g.ended),g.cls||'',g.title,g.code,g.players,p.rank,p.name,p.team||'',p.score])}qdlBlob(xlsxBuild([{name:'Games',rows:[['Date','Class','Quiz','Code','Players','Winner','Winner score'],...gs]},{name:'Scores',rows:sc}]),'roompulse-history.xlsx')}catch(e){qerr(e)}};\n const L=$('hlist');if(L)L.onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;const code=b.closest('.qitem').dataset.c,a=b.dataset.a;try{if(a==='del')return qhdel(code);const d=await qapi('/history/'+code,null,Q.tok);if(a==='open'){Q.histOpen={...d,code};qrender()}else qdownload(reportCSV(d.report,d.ended),(d.report.title||'results')+'-'+new Date(d.ended).toISOString().slice(0,16).replace(/[:T]/g,'-')+'.csv')}catch(er){qerr(er)}}}\nasync function qhdel(code){if(!confirm(t('تمسح اللعبة دي من السجل نهائياً؟')))return;try{await qapi('/history/delete',{code},Q.tok);Q.hist=await qapi('/history',null,Q.tok);Q.histOpen=null;qrender()}catch(e){qerr(e)}}\n/* ---------- builder ---------- */\nfunction qcard(x,i,n){const spot=x.type==='spot',cloud=x.type==='cloud';\n let h='<div class=\"qqcard\" data-i=\"'+i+'\"><div class=\"qrow between\"><span><span class=\"qtag\">'+(i+1)+'</span> <b>'+typeName(x.type)+'</b></span><span class=\"qrow\"><button type=\"button\" class=\"secondary\" data-a=\"up\" '+(i?'':'disabled')+' aria-label=\"'+t('فوق')+'\">↑</button><button type=\"button\" class=\"secondary\" data-a=\"down\" '+(i<n-1?'':'disabled')+' aria-label=\"'+t('تحت')+'\">↓</button><button type=\"button\" class=\"secondary qbtn-danger\" data-a=\"rm\">'+t('احذف السؤال')+'</button></span></div>'\n +'<label>'+t(spot?'الموقف أو التعليمات':'نص السؤال')+'</label><textarea data-f=\"text\" dir=\"auto\" maxlength=\"300\" style=\"min-height:70px\">'+esc(x.text)+'</textarea>';\n if(!cloud){h+='<p class=\"muted\">'+t(spot?'اختار السطر الغلط':'اختار الإجابة الصح')+'</p>';x.options.forEach((o,k)=>{h+='<div class=\"qopt\"><input type=\"radio\" name=\"c'+i+'\" data-f=\"correct\" data-k=\"'+k+'\" '+(x.correct===k?'checked':'')+' aria-label=\"'+t('اختار الإجابة الصح')+'\"><input type=\"text\" data-f=\"opt\" data-k=\"'+k+'\" dir=\"auto\" maxlength=\"'+(spot?200:120)+'\" placeholder=\"'+t(spot?'سطر في المحادثة':'اختيار')+' '+(k+1)+'\" value=\"'+esc(o)+'\">'+(x.options.length>2?'<button type=\"button\" class=\"secondary\" data-a=\"rmopt\" data-k=\"'+k+'\" aria-label=\"x\">✕</button>':'')+'</div>'});\n  if(x.options.length<(spot?6:4))h+='<button type=\"button\" class=\"secondary\" data-a=\"addopt\">+ '+t(spot?'إضافة سطر':'إضافة اختيار')+'</button>'}\n h+='<div class=\"qrow\" style=\"margin-top:10px\"><label style=\"margin:0\">'+t('الوقت بالثواني')+'</label><input type=\"number\" data-f=\"time\" min=\"5\" max=\"240\" value=\"'+x.time+'\" style=\"width:100px\"></div>'+(cloud?'':'<div class=\"qrow\" style=\"margin-top:10px\"><label style=\"margin:0\">'+t('أقصى نقاط للسؤال')+'</label><input type=\"number\" data-f=\"points\" min=\"1\" max=\"100\" step=\"1\" value=\"'+(x.points>100?1:(x.points||1))+'\" style=\"width:100px\"></div><p class=\"muted\">'+t('الإجابة الصح الأسرع بتاخد نقاط أكتر. الغلط بصفر.')+'</p>')+'</div>';return h}\nfunction editView(r){const d=Q.draft;\n r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><div class=\"qglass\"><label for=\"qtitle\">'+t('اسم الكويز')+'</label><input id=\"qtitle\" dir=\"auto\" maxlength=\"80\" value=\"'+esc(d.title)+'\"><div class=\"qrow\" style=\"margin:10px 0\"><label style=\"margin:0\" for=\"qallp\">'+t('نقاط كل الأسئلة')+'</label><input type=\"number\" id=\"qallp\" min=\"1\" max=\"100\" step=\"1\" value=\"1\" style=\"width:90px\"><button type=\"button\" class=\"secondary\" id=\"qapplyp\">'+t('طبّق على الكل')+'</button><button type=\"button\" class=\"secondary\" id=\"qresetp\">'+t('رجّع الكل لـ 1')+'</button></div><div id=\"qcards\">'+d.questions.map((x,i)=>qcard(x,i,d.questions.length)).join('')+'</div>'\n +'<p class=\"muted\">'+t('أضف سؤال')+'</p><div class=\"qrow\"><button type=\"button\" class=\"secondary\" data-add=\"mc\">+ '+t('اختيار من متعدد')+'</button><button type=\"button\" class=\"secondary\" data-add=\"spot\">+ '+t('اكتشف الغلطة')+'</button><button type=\"button\" class=\"secondary\" data-add=\"cloud\">+ '+t('سحابة كلمات')+'</button></div>'\n +'<div class=\"actions\"><button id=\"qsave\">'+t('احفظ الكويز')+'</button><button class=\"secondary\" id=\"qxlsx\">'+t('تحميل Excel')+'</button><button class=\"secondary\" id=\"qcsv\">'+t('تصدير CSV')+'</button><label class=\"btn secondary\" style=\"margin:0\">'+t('رفع Excel أو CSV')+'<input id=\"qfile2\" type=\"file\" accept=\".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\" hidden></label><button class=\"secondary\" id=\"qtpl2\">'+t('تحميل قالب Excel')+'</button><button class=\"secondary\" id=\"qcancel\">'+t('إلغاء')+'</button></div></div>';\n $('qtitle').oninput=e=>d.title=e.target.value;\n const setAll=v=>{v=Math.max(1,Math.min(100,parseInt(v)||1));for(const x of d.questions)if(x.type!=='cloud')x.points=v;editView(r)};$('qapplyp').onclick=()=>setAll($('qallp').value);$('qresetp').onclick=()=>setAll(1);\n const cards=$('qcards');\n cards.oninput=e=>{const c=e.target.closest('.qqcard');if(!c)return;const x=d.questions[+c.dataset.i],f=e.target.dataset.f;if(f==='text')x.text=e.target.value;else if(f==='opt')x.options[+e.target.dataset.k]=e.target.value;else if(f==='points')x.points=Math.max(1,Math.min(100,parseInt(e.target.value)||1));else if(f==='time')x.time=Math.max(5,Math.min(240,parseInt(e.target.value)||20))};\n cards.onchange=e=>{const c=e.target.closest('.qqcard');if(c&&e.target.dataset.f==='correct')d.questions[+c.dataset.i].correct=+e.target.dataset.k};\n cards.onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const i=+b.closest('.qqcard').dataset.i,x=d.questions[i],a=b.dataset.a;\n  if(a==='rm')d.questions.splice(i,1);else if(a==='up')[d.questions[i-1],d.questions[i]]=[d.questions[i],d.questions[i-1]];else if(a==='down')[d.questions[i+1],d.questions[i]]=[d.questions[i],d.questions[i+1]];\n  else if(a==='addopt')x.options.push('');else if(a==='rmopt'){const k=+b.dataset.k;x.options.splice(k,1);if(x.correct>=x.options.length||x.correct>k)x.correct=Math.max(0,x.correct>k?x.correct-1:0)}\n  editView($('quizRoot'))};\n r.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{d.questions.push(qblank(b.dataset.add));editView(r);window.scrollTo(0,document.body.scrollHeight)});\n $('qcancel').onclick=()=>{Q.view='lib';qrender()};$('qtpl2').onclick=()=>qdlBlob(xlsxBuild(qtemplateSheets()),'quiz-template.xlsx');$('qfile2').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const q=/\\.xlsx$/i.test(f.name)?fromRows(await xlsxRows(f)):fromCSV(await f.text());if(d.questions&&d.questions.length&&!confirm(t('الملف هيحل محل الأسئلة الحالية. متأكد؟')))return;Q.draft=q;Q.draftId=null;Q.view='edit';qrender();$('globalError').textContent=''}catch(er){error(er)}};$('qxlsx').onclick=()=>qdlBlob(xlsxBuild(quizSheets(d)),(d.title||'quiz')+'.xlsx');$('qcsv').onclick=()=>qdownload(toCSV(d),(d.title||'quiz')+'.csv');\n $('qsave').onclick=async()=>{try{if(!d.title.trim())throw new Error(t('اكتب اسم الكويز.'));if(!d.questions.length)throw new Error(t('أضف سؤال واحد على الأقل.'));\n  if(d.questions.some(x=>!x.text.trim()))throw new Error(t('اكتب نص كل سؤال.'));if(d.questions.some(x=>x.options&&x.options.some(o=>!o.trim())))throw new Error(t('كمّل اختيارات كل سؤال.'));\n  const res=await qapi('/library/save',{id:Q.draftId,quiz:d},Q.tok);await qreloadLib();$('globalError').textContent=''}catch(e){qerr(e)}}}\n/* ---------- launch ---------- */\nfunction launchView(r){const L=Q.launch;r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><h2 dir=\"auto\">'+esc(L.title)+'</h2><div class=\"qglass\"><div class=\"mode-buttons\"><button class=\"secondary\" id=\"qsolo\" aria-pressed=\"'+(L.teams===0)+'\">'+t('كل واحد لوحده')+'</button><button class=\"secondary\" id=\"qteams\" aria-pressed=\"'+(L.teams>0)+'\">'+t('فرق')+'</button></div>'+(L.teams>0?'<label for=\"qn\">'+t('عدد الفرق')+'</label><select id=\"qn\" style=\"font:inherit;padding:10px;border-radius:8px\">'+[2,3,4,5,6].map(n=>'<option '+(n===L.teams?'selected':'')+'>'+n+'</option>').join('')+'</select>':'')+'<label for=\"qcls\">'+t('اسم الفصل أو المجموعة (مطلوب)')+'</label><input id=\"qcls\" maxlength=\"60\" value=\"'+esc(L.cls||'')+'\" placeholder=\"'+t('مثال: باتش 12')+'\"><div class=\"qrow\" style=\"gap:8px;margin:8px 0\">'+qrecent().map(c=>'<button type=\"button\" class=\"secondary qchip\" data-c=\"'+esc(c)+'\">'+esc(c)+'</button>').join('')+'</div><div class=\"actions\"><button id=\"qgo\">'+t('ابدأ اللوبي')+'</button><button class=\"secondary\" id=\"qback\">'+t('إلغاء')+'</button></div></div>';\n $('qsolo').onclick=()=>{L.teams=0;launchView(r)};$('qteams').onclick=()=>{L.teams=L.teams||2;launchView(r)};if($('qn'))$('qn').onchange=e=>L.teams=+e.target.value;$('qback').onclick=()=>{Q.view='lib';qrender()};\n document.querySelectorAll('.qchip').forEach(b=>b.onclick=()=>{$('qcls').value=b.dataset.c});$('qcls').oninput=e=>L.cls=e.target.value;\n $('qgo').onclick=async()=>{try{const cls=$('qcls').value.trim();if(!cls){$('qcls').focus();throw new Error(t('اكتب اسم الفصل أو المجموعة.'))}qremember(cls);const d=await qapi('/game/create',{quizId:L.id,teams:L.teams,cls},Q.tok);Q.host={code:d.code,token:d.token,title:L.title};qhostSave();Q.view='host';Q.sig='';Q.gs=null;Q.report=null;startHostPoll()}catch(e){qerr(e)}}}\n/* ---------- host game ---------- */\nfunction startHostPoll(){qstop();hostTick();Q.poll=setInterval(()=>{if(role!=='quiz'){qstop();return}if(!document.hidden)hostTick()},1500);qtimerLoop()}\nasync function hostTick(){if(!Q.host)return;try{const s=await qapi('/game/'+Q.host.code+'/state',null,Q.host.token);Q.off=s.serverNow-Date.now();Q.gs=s;\n  if(s.phase==='ended'&&!Q.report&&!Q.reporting){Q.reporting=true;try{Q.report=await qapi('/game/'+Q.host.code+'/report',null,Q.host.token)}catch{}Q.reporting=false}\n  const sig=[s.phase,s.qi,s.answered,s.playerCount,s.state,!!Q.report,lang].join('|');if(sig!==Q.sig){Q.sig=sig;qrender()}}catch(e){if(/الكود غير صحيح/.test(e.message)){Q.host=null;qhostSave();qstop();Q.view=Q.tok?'lib':'auth';qrender()}}}\nfunction qtimerLoop(){clearInterval(Q.tl);Q.tl=setInterval(()=>{const s=Q.gs;if(!s||!['quiz','quizPlay'].includes(role))return;const el=document.getElementById('qtime');if(el&&s.phase==='answering'){const r=qrem(s);el.textContent=r;const b=document.getElementById('qtbar');if(b){const tot=Math.max(1,(s.qEnd-s.qStart)/1000);b.style.width=Math.max(0,Math.min(100,100*r/tot))+'%'}if(r===0&&!Q.refetch){Q.refetch=true;setTimeout(()=>{Q.refetch=false;role==='quiz'?hostTick():playTick()},500)}}},250)}\nfunction optCls(i){return 'c'+(i%6)}\nfunction qavGet(){let v=-1;try{v=parseInt(localStorage.getItem('quiz.av'))}catch{}if(!(v>=0&&v<8)){v=Math.floor(Math.random()*8);qavSet(v)}return v}\nfunction qavSet(v){try{localStorage.setItem('quiz.av',String(v))}catch{}Q.av=v}\nfunction qavPicker(){const cur=qavGet();return '<div class=\"qavs\" role=\"group\">'+[0,1,2,3,4,5,6,7].map(i=>'<button type=\"button\" class=\"qavpick\" data-i=\"'+i+'\" aria-pressed=\"'+(i===cur)+'\" aria-label=\"'+QAVN[i]+'\">'+qav(i)+'</button>').join('')+'</div>'}\nconst QAVN=['panda','dino','cat','fox','frog','penguin','rabbit','lion'];\nfunction qav(i,c){return typeof i==='number'&&i>=0&&i<8?'<svg class=\"qav '+(c||'')+'\" aria-hidden=\"true\"><use href=\"#qa'+i+'\"/></svg>':''}\nfunction lbHtml(s,meName){return '<div class=\"qlb\">'+(s.leaderboard||[]).map(p=>'<div class=\"r'+(meName&&p.name===meName?' me':'')+'\"><span>'+p.rank+'. '+qav(p.av)+'<bdi dir=\"auto\">'+esc(p.name)+'</bdi>'+(s.teams?' <small class=\"qbadge\">'+t('الفريق')+' '+p.team+'</small>':'')+'</span><span>'+fmtp(p.score)+'</span></div>').join('')+'</div>'}\nfunction teamHtml(s){return s.teamBoard?'<h3>'+t('ترتيب الفرق')+'</h3><div class=\"qlb\">'+s.teamBoard.map((x,i)=>'<div class=\"r\"><span>'+(i+1)+'. '+t('الفريق')+' '+x.team+' <small class=\"qbadge\">'+x.members+' '+t('عضو')+'</small></span><span>'+fmtp(x.score)+'</span></div>').join('')+'</div>':''}\nfunction cloudHtml(words){if(!words||!words.length)return'';const mx=Math.max(...words.map(w=>w.n));const cols=['#E60000','#30242a','#b3001b','#7a6068'];return '<div class=\"qcloud\" dir=\"auto\">'+words.map((w,i)=>'<span style=\"font-size:'+Math.round(16+34*w.n/mx)+'px;font-weight:'+(w.n>1?900:700)+';color:'+cols[i%4]+'\">'+esc(w.word)+'</span>').join('')+'</div>'}\nfunction podiumHtml(lb){const a=lb||[];const b=(i)=>a[i]?qav(a[i].av,'big')+'<bdi dir=\"auto\">'+esc(a[i].name)+'</bdi><br>'+fmtp(a[i].score):'';return '<div class=\"qpod\"><div class=\"p2\">2<br>'+b(1)+'</div><div class=\"p1\">1<br>'+b(0)+'</div><div class=\"p3\">3<br>'+b(2)+'</div></div>'}\nfunction qshare(){const s=Q.gs;if(!s)return;const u=location.origin+joinPath+'?code='+s.code+'&lang='+lang;const title=Q.host.title||s.title||'';const txt=t('انضم للكويز')+': '+title+'\\n'+t('الكود')+': '+s.code+'\\n'+u;if(navigator.share){navigator.share({title:title,text:txt,url:u}).catch(()=>{})}else{const done=()=>{const b=$('qshare');if(b){const o=b.textContent;b.textContent=t('اتنسخ الرابط والكود');setTimeout(()=>{if($('qshare'))$('qshare').textContent=o},2000)}};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,()=>prompt(t('انسخ الرابط'),txt));else prompt(t('انسخ الرابط'),txt)}}\nasync function qendGame(){if(!Q.host)return;if(!confirm(t('تنهي اللعبة دلوقتي؟ هتتسجل في السجل.')))return;try{await qapi('/game/'+Q.host.code+'/host',{action:'end'},Q.host.token);Q.sig='';if(Q.view==='host'){await hostTick()}else{Q.host=null;qhostSave();Q.gs=null;Q.report=null;await qreloadLib()}}catch(e){qerr(e)}}\nfunction hostView(r){hostView0(r);const b=r.querySelector('#qshare');if(b){b.onclick=qshare;if(Q.gs&&Q.gs.phase!=='ended'){const e=document.createElement('button');e.type='button';e.className='secondary qbtn-danger';e.id='qendgame';e.textContent=t('إنهاء اللعبة');e.onclick=qendGame;b.after(e)}}}\nfunction hostView0(r){const s=Q.gs;if(!s){r.innerHTML='<p class=\"muted\">…</p>';return}\n const head='<div class=\"qrow between\"><span class=\"qtag dark\" dir=\"ltr\">'+s.code+'</span><span class=\"qtag\">'+esc(Q.host.title||s.title)+'</span><button type=\"button\" class=\"secondary\" id=\"qshare\">'+t('شارك الرابط')+'</button></div>';\n if(s.phase==='lobby'){const u=location.origin+joinPath+'?code='+s.code+'&lang='+lang;\n  r.innerHTML=head+'<div class=\"qglass qcenter\"><p>'+t('ادخل على الرابط واكتب الكود')+'</p><div class=\"qcode\">'+s.code+'</div><img id=\"qqr\" alt=\"QR\" width=\"200\" height=\"200\" src=\"'+apiOrigin+'/qr?code='+s.code+'&lang='+lang+(pagesHost?'&frontend=pages':'')+'\" style=\"background:#fff;border-radius:12px\"><p class=\"muted\" dir=\"ltr\">'+esc(u)+'</p><h3>'+(s.playerCount||0)+' '+t('انضموا')+'</h3><div class=\"qchips\">'+(s.players||[]).map(p=>'<span class=\"qchip\" dir=\"auto\">'+qav(p.av)+esc(p.name)+(s.teams?' · '+p.team:'')+'</span>').join('')+'</div><p class=\"muted\">'+((s.playerCount||0)?'':t('استنى المتدربين يدخلوا…'))+'</p><div class=\"actions\" style=\"justify-content:center\"><button id=\"qstart\" '+(s.playerCount?'':'disabled')+'>'+t('ابدأ الكويز')+'</button><button class=\"secondary\" id=\"qleave\">'+t('رجوع للمكتبة')+'</button></div></div>';\n  $('qstart').onclick=()=>hostAct({action:'start'});$('qleave').onclick=()=>{qstop();Q.view='lib';qrender()};return}\n if(s.phase==='answering'||s.phase==='reveal'){const q=s.q,rev=s.phase==='reveal',cloud=q.type==='cloud';let body='';\n  if(!cloud)body='<div class=\"qans\">'+q.options.map((o,i)=>'<div class=\"qa '+optCls(i)+(rev&&i===q.correct?' right':'')+(rev&&i!==q.correct?' dim':'')+'\"><span class=\"sym\">'+SYM[i]+'</span><span dir=\"auto\" style=\"flex:1\">'+esc(o)+'</span>'+(rev?'<span class=\"cnt\">'+(s.counts?s.counts[i]:0)+'</span>':(i===q.correct?'<span>✓</span>':''))+'</div>').join('')+'</div>';\n  else if(rev)body=cloudHtml(s.words);\n  r.innerHTML=head+'<div class=\"qglass\"><div class=\"qrow between\"><span class=\"qtag\">'+(s.qi+1)+' / '+s.total+'</span>'+(rev?'<span class=\"qtag dark\">'+(s.answered||0)+' '+t('أجاوبوا')+'</span>':'<div class=\"qtimer\" id=\"qtime\">'+qrem(s)+'</div><span class=\"qtag dark\">'+(s.answered||0)+'/'+(s.playerCount||0)+' '+t('أجاوبوا')+'</span>')+'</div>'+(rev?'':'<div class=\"qbar\"><i id=\"qtbar\" style=\"width:100%\"></i></div>')+'<div class=\"qq\" dir=\"auto\">'+esc(q.text)+'</div>'+body\n  +(rev?'<h3>'+t('الترتيب')+'</h3>'+lbHtml(s)+teamHtml(s):'')+'<div class=\"actions\">'+(rev?'<button id=\"qnext\">'+t(s.qi+1>=s.total?'اعرض النتيجة النهائية':'السؤال التالي')+'</button>':'<button class=\"secondary\" id=\"qrev\">'+t('اعرض النتيجة دلوقتي')+'</button>')+'</div></div>';\n  if(rev)$('qnext').onclick=()=>hostAct({action:'next',qi:s.qi});else $('qrev').onclick=()=>hostAct({action:'reveal'});return}\n if(s.phase==='ended'){const rp=Q.report;r.innerHTML=head+'<div class=\"qglass\"><h2 class=\"qcenter\">'+t('النتيجة النهائية')+'</h2>'+podiumHtml(s.leaderboard)+lbHtml(s)+teamHtml(s)+'</div>'\n  +'<div class=\"qglass\"><h2>'+t('تقرير الجلسة')+'</h2>'+(rp?rp.questions.map(q=>'<div class=\"qitem\" style=\"display:block\"><b dir=\"auto\">'+(q.index+1)+'. '+esc(q.text)+'</b>'+(q.type==='cloud'?'<div>'+cloudHtml(q.words.slice(0,40))+'</div>':'<div class=\"qbar\"><i style=\"width:'+q.pct+'%'+(q.pct<50?';background:#30242a':'')+'\"></i></div><small>'+q.pct+'% '+t('صح')+(q.pct<50?' · ⚠ '+t('محتاج مراجعة'):'')+'</small>'+(q.wrong.length?'<small>'+t('اللي غلطوا')+': '+q.wrong.map(w=>'<bdi dir=\"auto\">'+esc(w.name)+'</bdi>').join('، ')+'</small>':'')+(q.missing.length?'<small>'+t('ماجاوبوش')+': '+q.missing.map(w=>'<bdi dir=\"auto\">'+esc(w)+'</bdi>').join('، ')+'</small>':''))+'</div>').join(''):'<p class=\"muted\">'+t('جاري تجهيز التقرير…')+'</p>')\n  +'<div class=\"actions\"><button id=\"qexp\" '+(rp?'':'disabled')+'>'+t('تصدير النتايج CSV')+'</button><button class=\"secondary\" id=\"qdone\">'+t('رجوع للمكتبة')+'</button></div></div>';\n  $('qexp').onclick=()=>{if(!Q.report)return;qdownload(reportCSV(Q.report),(Q.report.title||'results')+'-results.csv')};\n  $('qdone').onclick=()=>{qstop();Q.host=null;qhostSave();Q.gs=null;Q.report=null;Q.view='lib';openQuiz()}}}\nfunction reportCSV(rp,when){const n=rp.questions.length,L=[];if(when)L.push(['date',new Date(when).toISOString().replace('T',' ').slice(0,16)+' UTC'],['quiz',rp.title],[]);L.push(['rank','name','team','score',...(rp.players[0]&&rp.players[0].pts?rp.questions.map((_,i)=>'Q'+(i+1)+'_points'):[])]);for(const p of rp.players)L.push([p.rank,p.name,rp.teams?p.team:'',fmtp(p.score),...(p.pts?p.pts.map(fmtp):[])]);L.push([]);L.push(['question','type','answered','correct_percent','wrong_names']);for(const q of rp.questions)L.push([q.text,q.type,q.answered,q.type==='cloud'?'':q.pct,q.type==='cloud'?q.words.map(w=>w.word+'×'+w.n).join(' | '):q.wrong.map(w=>w.name).join(' | ')]);return L.map(r=>r.map(csvCell).join(',')).join('\\r\\n')}\nasync function hostAct(b){try{await qapi('/game/'+Q.host.code+'/host',b,Q.host.token);Q.sig='';hostTick()}catch(e){qerr(e)}}\n/* ---------- player ---------- */\nasync function quizTryJoin(){const code=$('joinCode').value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));if(!/^\\d{6}$/.test(code))return join();\n let s;try{s=await qapi('/game/'+code+'/state?client='+encodeURIComponent(client()))}catch(e){return join()}\n Q.pl={code,name:null};Q.gs=s;Q.off=s.serverNow-Date.now();Q.sig='';let nm=null;try{nm=sessionStorage.getItem('quiz.name.'+code)}catch{}\n show('quizPlay');if(s.me){Q.pl.name=s.me.name;startPlayPoll();playRender()}else if(nm&&s.state!=='ended'){await playJoin(nm)}else playRender()}\nasync function playJoin(name){try{const d=await qapi('/game/'+Q.pl.code+'/join',{client:client(),name,avatar:qavGet()});Q.pl.name=d.name;try{sessionStorage.setItem('quiz.name.'+Q.pl.code,d.name)}catch{}Q.sig='';startPlayPoll();await playTick()}catch(e){error(e);playRender()}}\nfunction startPlayPoll(){qstop();Q.wsOff=false;Q.wsTry=0;qwsOpen();Q.poll=setInterval(()=>{if(role!=='quizPlay'){qstop();return}if(Q.ws&&Q.ws.readyState===1)return;if(!document.hidden)playTick()},3000);qtimerLoop()}\nfunction qwsOpen(){if(Q.wsOff||role!=='quizPlay'||typeof WebSocket==='undefined')return;try{const base=(apiOrigin||location.origin).replace(/^http/,'ws');const ws=new WebSocket(base+'/api/quiz/game/'+Q.pl.code+'/ws?client='+encodeURIComponent(client()));Q.ws=ws;\n ws.onopen=()=>{Q.wsTry=0;clearInterval(Q.hb);Q.hb=setInterval(()=>{try{ws.send('ping')}catch{}},25000)};\n ws.onmessage=e=>{if(e.data==='pong')return;let m;try{m=JSON.parse(e.data)}catch{return}\n  if(m.t==='s'){if(!m.s.me)delete m.s.me;applyPlayState(m.s)}\n  else if(m.t==='ack'){if(m.ok){try{ws.send(JSON.stringify({t:'r'}))}catch{}}else{playTick()}}\n  else if(m.t==='gone'){playTick()}};\n ws.onclose=()=>{if(Q.ws===ws)Q.ws=null;clearInterval(Q.hb);if(Q.wsOff||role!=='quizPlay')return;Q.wsTry=(Q.wsTry||0)+1;if(Q.wsTry<=8)setTimeout(qwsOpen,800+Math.random()*2200+Q.wsTry*400)};\n ws.onerror=()=>{try{ws.close()}catch{}}}catch{}}\nfunction applyPlayState(s){Q.off=s.serverNow-Date.now();const prev=Q.gs;Q.gs=s;if(prev&&(prev.qi!==s.qi||prev.phase!==s.phase))Q.sel=-1;const sig=[s.phase,s.qi,s.me&&s.me.answered,s.me&&s.me.score,s.me&&s.me.rank,s.playerCount,lang].join('|');if(sig!==Q.sig){Q.sig=sig;playRender()}}\nasync function playTick(){try{const s=await qapi('/game/'+Q.pl.code+'/state?client='+encodeURIComponent(client()));applyPlayState(s)}catch(e){}}\nasync function playSend(body){if(Q.ws&&Q.ws.readyState===1){try{Q.ws.send(JSON.stringify({t:'a',qi:Q.gs.qi,body}));return}catch{}}try{await qapi('/game/'+Q.pl.code+'/answer',{client:client(),qi:Q.gs.qi,...body});Q.sig='';await playTick()}catch(e){error(e);await playTick()}}\nfunction playRender(){if(role!=='quizPlay')return;const r=$('quizPlayRoot'),s=Q.gs;\n const head='<div class=\"qrow between\"><span class=\"qtag\">'+esc(s.title)+'</span>'+(s.me?'<span class=\"qtag dark\" dir=\"auto\">'+qav(s.me.av)+esc(s.me.name)+' · '+fmtp(s.me.score)+'</span>':'')+'</div>';\n if(!s.me){r.innerHTML=head+'<div class=\"qglass\"><h2>'+t('اكتب اسمك')+'</h2><p class=\"muted\">'+t('اختار شخصيتك')+'</p>'+qavPicker()+'<input id=\"qname\" dir=\"auto\" maxlength=\"40\" placeholder=\"'+t('اكتب اسمك')+'\" autocomplete=\"off\"><div class=\"actions\"><button id=\"qjoin\">'+t('ادخل الكويز')+'</button></div></div>';\n  r.querySelectorAll('.qavpick').forEach(b=>b.onclick=()=>{qavSet(+b.dataset.i);r.querySelectorAll('.qavpick').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});const go=()=>{const v=$('qname').value.trim();if(v)playJoin(v)};$('qjoin').onclick=go;$('qname').onkeydown=e=>{if(e.key==='Enter')go()};return}\n if(s.phase==='lobby'){r.innerHTML=head+'<div class=\"qglass qcenter\"><div class=\"qbig\">🎮</div><h2>'+t('أنت جوّه. استنى المدرب يبدأ.')+'</h2>'+(s.teams?'<p><b>'+t('فريقك')+': '+s.me.team+'</b></p>':'')+'<p class=\"muted\">'+(s.playerCount||0)+' '+t('انضموا')+'</p></div>';return}\n if(s.phase==='answering'){const q=s.q,a=s.me.answered;let body='';\n  if(q.type==='mc')body='<div class=\"qans\">'+q.options.map((o,i)=>'<button class=\"qa '+optCls(i)+(s.me.choice===i?' picked':'')+'\" data-i=\"'+i+'\" '+(a?'disabled':'')+'><span class=\"sym\">'+SYM[i]+'</span><span dir=\"auto\">'+esc(o)+'</span></button>').join('')+'</div>';\n  else if(q.type==='spot')body=q.options.map((o,i)=>'<button class=\"qbub'+((a?s.me.choice:Q.sel)===i?' picked':'')+'\" data-i=\"'+i+'\" '+(a?'disabled':'')+' dir=\"auto\">'+esc(o)+'</button>').join('')+(a?'':'<div class=\"actions\"><button id=\"qsend\" '+(Q.sel>=0?'':'disabled')+'>'+t('ابعت الإجابة')+'</button></div>');\n  else body=a?'<p class=\"qcenter\"><b dir=\"auto\">'+esc(s.me.text||'')+'</b></p>':'<input id=\"qword\" dir=\"auto\" maxlength=\"30\" placeholder=\"'+t('اكتب كلمة')+'\" autocomplete=\"off\"><div class=\"actions\"><button id=\"qsend\">'+t('ابعت')+'</button></div>';\n  r.innerHTML=head+'<div class=\"qglass\"><div class=\"qrow between\"><span class=\"qtag\">'+(s.qi+1)+' / '+s.total+'</span><div class=\"qtimer\" id=\"qtime\">'+qrem(s)+'</div></div><div class=\"qbar\"><i id=\"qtbar\" style=\"width:100%\"></i></div><div class=\"qq\" dir=\"auto\">'+esc(q.text)+'</div>'+body+(a?'<p class=\"qcenter muted\">'+t('اتسجلت إجابتك. استنى باقي القاعة…')+'</p>':'')+'</div>';\n  if(!a){if(q.type==='mc')r.querySelectorAll('button.qa').forEach(b=>b.onclick=()=>{r.querySelectorAll('button.qa').forEach(x=>x.disabled=true);playSend({choice:+b.dataset.i})});\n   else if(q.type==='spot'){r.querySelectorAll('.qbub').forEach(b=>b.onclick=()=>{Q.sel=+b.dataset.i;r.querySelectorAll('.qbub').forEach(x=>x.classList.toggle('picked',x===b));$('qsend').disabled=false});$('qsend').onclick=()=>{if(Q.sel>=0){$('qsend').disabled=true;playSend({choice:Q.sel})}}}\n   else{const go=()=>{const v=$('qword').value.trim();if(v){$('qsend').disabled=true;playSend({text:v})}};$('qsend').onclick=go;$('qword').onkeydown=e=>{if(e.key==='Enter')go()}}}return}\n if(s.phase==='reveal'){const m=s.me,q=s.q,cloud=q.type==='cloud';let top;\n  if(cloud)top='<div class=\"qbig\">☁️</div>'+cloudHtml(s.words);\n  else if(!m.answered)top='<div class=\"qbig\">⏱</div><h2 class=\"qcenter qno\">'+t('وقتك خلص')+'</h2>';\n  else top='<div class=\"qbig '+(m.ok?'qok':'qno')+'\">'+(m.ok?'✓':'✗')+'</div><h2 class=\"qcenter '+(m.ok?'qok':'qno')+'\">'+t(m.ok?'إجابة صح!':'إجابة غلط')+(m.ok?' +'+fmtp(m.points):'')+'</h2>';\n  const right=!cloud?'<p class=\"qcenter\">'+t('الإجابة الصح')+': <b dir=\"auto\">'+esc(q.options[q.correct])+'</b></p>':'';\n  r.innerHTML=head+'<div class=\"qglass qcenter\">'+top+right+'<p>'+t('نقاطك')+': <b>'+fmtp(m.score)+'</b> · '+t('مركزك')+': <b>'+(m.rank||'-')+'</b>'+(s.teams?' · '+t('ترتيب فريقك')+': <b>'+(m.teamRank||'-')+'</b>':'')+'</p><p class=\"muted\">'+t('استنى السؤال الجاي…')+'</p></div>'+'<div class=\"qglass\"><h3>'+t('الترتيب')+'</h3>'+lbHtml(s,m.name)+'</div>';return}\n if(s.phase==='ended'){const m=s.me;r.innerHTML=head+'<div class=\"qglass qcenter\"><h2>'+t('النتيجة النهائية')+'</h2>'+podiumHtml(s.leaderboard)+'<p>'+t('مركزك')+': <b>'+(m.rank||'-')+'</b> · '+t('نقاطك')+': <b>'+fmtp(m.score)+'</b>'+(s.teams?' · '+t('ترتيب فريقك')+': <b>'+(m.teamRank||'-')+'</b>':'')+'</p><p class=\"muted\">'+t('الكويز خلص. شكراً على المشاركة!')+'</p></div>'+teamHtml(s)}}\n/* ---------- wiring ---------- */\n$('quizTab').onclick=openQuiz;\n$('joinButton').onclick=quizTryJoin;\n{const _sl=setLanguage;setLanguage=function(v){_sl(v);Q.sig='';if(role==='quiz')qrender();if(role==='quizPlay'&&Q.gs)playRender()}}\n\n/* ===== QUIZ EXTRAS: sound, hints, autosave ===== */\nObject.assign(EN,{\"صوت\":\"Sound\",\"اكتم الصوت\":\"Mute\",\"شغّل الصوت\":\"Unmute\",\n\"اكتب الأسئلة، حدّد الإجابة الصح، وبعدين احفظ.\":\"Write the questions, mark the right answer, then save.\",\n\"اختار كويز وابدأه، أو اعمل واحد جديد.\":\"Pick a quiz to start, or create a new one.\",\n\"اختار شكل اللعب: فردي أو فرق.\":\"Choose how to play: individual or teams.\",\n\"شارك الكود أو الـQR، واضغط ابدأ لما الكل يدخل.\":\"Share the code or QR, and press Start when everyone has joined.\",\n\"اللاعبين بيجاوبوا دلوقتي. تقدر تعرض النتيجة بدري.\":\"Players are answering now. You can show the result early.\",\n\"دي الإجابة والترتيب. اضغط التالي لما تبقى جاهز.\":\"Here are the answer and ranking. Press Next when ready.\",\n\"الكويز خلص. صدّر النتايج أو ارجع للمكتبة.\":\"The quiz is over. Export the results or go back to the library.\",\n\"رجّعنا تعديلاتك اللي ما اتحفظتش.\":\"We restored your unsaved changes.\",\"ابدأ من جديد\":\"Start over\",\"اتحفظ تلقائياً\":\"Autosaved\",\"الموسيقى: شغّالة\":\"Music: on\",\"الموسيقى: مقفولة\":\"Music: off\",\"الموسيقى: هتشتغل مع السؤال\":\"Music: plays during questions\",\"الموسيقى: دوس هنا عشان الصوت يشتغل\":\"Music: tap here to enable sound\"});\nconst QV3=(()=>{const V3={bpm:120,kick:'half',kv:0.4,snare:1,clap:1,hat16:0,bassWave:'triangle',bassVol:0.3,bassLP:900,bassPat:[0,null,12,null,0,null,7,12],pad:0,stabs:[1,3],arp:[0,2,1,2,0,2,1,2],arpWave:'triangle',arpVol:0.07,arpLP:4000,leadWave:'square',leadVol:0.05,leadLP:3000,leadLen:0.5,bell:1, chords:[[60,64,67],[55,59,62],[57,60,64],[53,57,60]],roots:[48,43,45,41], mel:[[84,0,79,0,76,79,0,84],[83,0,79,0,74,79,0,83],[81,0,76,0,72,76,0,81],[81,0,77,0,72,77,0,84],[88,0,84,0,79,84,0,88],[86,0,83,0,79,83,0,86],[84,0,81,0,76,81,0,84],[84,0,0,81,77,0,84,0]]}; return V3})();\nconst QAPPL='data:audio/mpeg;base64,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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//t0xK0DzLyU6GM9KUAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';\nconst QX=(()=>{\nlet ctx=null,master=null,mus=null,muted=false;try{muted=localStorage.getItem('quiz.mute')==='1'}catch{}\nfunction unlock(){try{if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;ctx=new A();master=ctx.createGain();master.gain.value=muted?0:0.9;master.connect(ctx.destination)}if(ctx.state==='suspended')ctx.resume().then(()=>{try{watch(true)}catch{}}).catch(()=>{});loadApp()}catch{}}\n['pointerdown','pointerup','click','keydown','touchstart','touchend'].forEach(e=>addEventListener(e,unlock,{passive:true,capture:true}));\nfunction ready(){return ctx&&ctx.state==='running'&&!muted}\nfunction stopMusic(){if(mus){clearTimeout(mus.t);try{mus.g.gain.cancelScheduledValues(0);mus.g.gain.setTargetAtTime(0,ctx.currentTime,0.08)}catch{}const g=mus.g;setTimeout(()=>{try{g.disconnect()}catch{}},600);mus=null}}\nlet musicOn=true;try{musicOn=localStorage.getItem('quiz.music')!=='0'}catch{}\nfunction setMusic(v){musicOn=v;try{localStorage.setItem('quiz.music',v?'1':'0')}catch{}if(!v)stopMusic();btn();watch(true)}\nfunction startMusic(){if(mus||!ready()||!musicOn)return;const g=ctx.createGain();g.gain.value=0.85;g.connect(master);const S=QS.msess(ctx,g),V=QV3,barLen=4*60/V.bpm;let next=ctx.currentTime+0.1,k=0;const m={g,t:0};mus=m;\n const pump=()=>{if(mus!==m)return;try{while(next<ctx.currentTime+2.2){QS.mbar(ctx,g,V,k%8,next,S.R,S.E,S.lead);next+=barLen;k++}}catch{}m.t=setTimeout(pump,300)};pump()}\nfunction once(fn){if(ready()){try{fn(ctx,master,ctx.currentTime+0.03)}catch{}}}\nfunction setMuted(v){muted=v;try{localStorage.setItem('quiz.mute',v?'1':'0')}catch{}if(master)master.gain.value=v?0:0.9;if(v)stopMusic();btn();watch(true)}\nlet appBuf=null,appLoading=false;function loadApp(){if(appBuf||appLoading||!ctx)return;appLoading=true;Promise.resolve().then(()=>{const bin=atob(QAPPL.split(',')[1]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return ctx.decodeAudioData(u.buffer)}).then(b=>{appBuf=b}).catch(()=>{appLoading=false})}\nfunction playApp(){try{const src=ctx.createBufferSource();src.buffer=appBuf;const g=ctx.createGain();g.gain.value=0.8;src.connect(g);g.connect(master);src.start()}catch{}}\nfunction applause(){if(muted||!ctx)return;if(appBuf){if(ctx.state==='running')playApp();else ctx.resume().then(playApp).catch(()=>{});return}\n loadApp();let n=0;const w=setInterval(()=>{n++;if(appBuf){clearInterval(w);if(!muted)playApp()}else if(n>40){clearInterval(w);try{const a=new Audio(QAPPL);a.volume=1;if(!muted)a.play().catch(()=>{})}catch{}}},150)}\nfunction confetti(){const box=document.createElement('div');box.className='qconf';const cols=['#E60000','#ffffff','#ff6b6b','#ffd166','#4cc38a'];for(let i=0;i<70;i++){const p=document.createElement('i');p.style.left=Math.random()*100+'%';p.style.background=cols[i%cols.length];p.style.animationDelay=Math.random()*1.2+'s';p.style.animationDuration=2.4+Math.random()*2+'s';p.style.setProperty('--dx',(Math.random()*160-80)+'px');box.appendChild(p)}document.body.appendChild(box);setTimeout(()=>box.remove(),6500)}\nfunction mstate(){if(muted)return 'off';if(!musicOn)return 'off';if(!ctx||ctx.state!=='running')return 'blocked';return mus?'playing':'waiting'}\nconst SPK_ON='<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 9.5v5h4l5 4v-13l-5 4z\" fill=\"currentColor\"/><path d=\"M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12\"/></svg>',SPK_OFF='<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 9.5v5h4l5 4v-13l-5 4z\" fill=\"currentColor\"/><path d=\"M17 9.5l4.5 5M21.5 9.5l-4.5 5\"/></svg>';\nfunction soundOff(){const host=role==='quiz'&&Q.view==='host';return muted||(host&&!musicOn)}\nfunction btn(){let b=document.getElementById('qmute');const on=(role==='quiz'&&Q.view==='host')||role==='quizPlay';const old=document.getElementById('qmusic');if(old)old.remove();if(!on){if(b)b.remove();return}const host=role==='quiz'&&Q.view==='host';if(!b){b=document.createElement('button');b.id='qmute';b.type='button';b.className='secondary';b.onclick=()=>{unlock();if(soundOff()){setMuted(false);if(host)setMusic(true)}else{if(host)setMusic(false);setMuted(true)}};document.body.appendChild(b)}const off=soundOff();b.innerHTML=off?SPK_OFF:SPK_ON;b.dataset.state=off?'off':(host&&mstate()==='blocked'?'blocked':'on');b.title=b.ariaLabel=t(off?'شغّل الصوت':'اكتم الصوت')}\nlet last=null;\nfunction watch(force){btn();const s=Q.gs,host=role==='quiz'&&Q.view==='host',pl=role==='quizPlay';if(!s||!(host||pl)){stopMusic();last=null;return}\n const key=s.code+'|'+s.phase+'|'+s.qi+'|'+(pl?'p':'h');\n if(host){if(s.phase==='answering')startMusic();else stopMusic()}else stopMusic();\n if(key===last&&!force)return;const prev=last;last=key;if(!force&&prev&&(s.phase==='answering'||s.phase==='reveal')){try{window.scrollTo({top:0,behavior:'smooth'})}catch{}}if(force||!prev)return;if(prev.split('|')[0]!==key.split('|')[0])return;\n if(s.phase==='reveal'&&pl&&s.me&&s.me.answered&&s.q&&s.q.type!=='cloud'){once(s.me.ok?QS.ting:QS.buzz)}\n if(s.phase==='ended'){applause();confetti()}}\nsetInterval(()=>watch(false),400);\nreturn {unlock,watch}})();\n/* hints */\n{const H={edit:'اكتب الأسئلة، حدّد الإجابة الصح، وبعدين احفظ.',lib:'اختار كويز وابدأه، أو اعمل واحد جديد.',launch:'اختار شكل اللعب: فردي أو فرق.'};\nconst HP={lobby:'شارك الكود أو الـQR، واضغط ابدأ لما الكل يدخل.',answering:'اللاعبين بيجاوبوا دلوقتي. تقدر تعرض النتيجة بدري.',reveal:'دي الإجابة والترتيب. اضغط التالي لما تبقى جاهز.',ended:'الكويز خلص. صدّر النتايج أو ارجع للمكتبة.'};\nconst _qr=qrender;qrender=function(){_qr();if(role!=='quiz')return;const r=$('quizRoot');if(!r)return;let k=H[Q.view];if(Q.view==='host'&&Q.gs)k=HP[Q.gs.phase];if(!k)return;const old=r.querySelector('.qhint');if(old)old.remove();const p=document.createElement('p');p.className='qhint';p.textContent=t(k);r.insertBefore(p,r.firstChild)}}\n/* autosave of drafts */\n{const key=()=>'quiz.draft.'+(Q.draftId||'new');let tm=0;\nconst save=()=>{if(role!=='quiz'||Q.view!=='edit'||!Q.draft||Q._base==null)return;try{const cur=JSON.stringify(Q.draft);if(cur===Q._base)localStorage.removeItem(key());else localStorage.setItem(key(),JSON.stringify({base:Q._base,cur}))}catch{}};\nconst sched=()=>{clearTimeout(tm);tm=setTimeout(save,500)};\nconst _ev=editView;editView=function(r){if(Q._dr!==Q.draft){Q._dr=Q.draft;Q._base=JSON.stringify(Q.draft);try{const s=JSON.parse(localStorage.getItem(key())||'null');if(s&&s.base===Q._base&&s.cur!==Q._base){Q.draft=Q._dr=JSON.parse(s.cur);qtoast(t('رجّعنا تعديلاتك اللي ما اتحفظتش.'),{label:t('ابدأ من جديد'),fn:()=>{try{localStorage.removeItem(key())}catch{}Q.draft=Q._dr=JSON.parse(Q._base);editView($('quizRoot'))}})}}catch{}}_ev(r);sched()};\naddEventListener('input',e=>{if(role==='quiz'&&Q.view==='edit'&&e.target.closest&&e.target.closest('#quizRoot'))sched()},true);\naddEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});\nconst _api=qapi;qapi=async function(p,b,tok){const k=key(),res=await _api(p,b,tok);if(p==='/library/save'){try{localStorage.removeItem(k)}catch{}}return res}}\nfunction qtoast(msg,act){const old=document.getElementById('qtoast');if(old)old.remove();const d=document.createElement('div');d.id='qtoast';d.setAttribute('role','status');const s=document.createElement('span');s.textContent=msg;d.appendChild(s);if(act){const a=document.createElement('button');a.type='button';a.className='secondary';a.textContent=act.label;a.onclick=()=>{act.fn();d.remove()};d.appendChild(a)}const x=document.createElement('button');x.type='button';x.className='secondary';x.textContent='✕';x.setAttribute('aria-label','close');x.onclick=()=>d.remove();d.appendChild(x);document.body.appendChild(d);setTimeout(()=>d.remove(),5000)}\n\n/* ===== Teams, accounts, Admin ===== */\nObject.assign(EN,{\"بتظهر مرة واحدة بس، ابعتها للفريق بنفسك.\": \"Shown once only. Send it to the Team yourself.\"});\nObject.assign(EN,{\"تعديل اليوزر\": \"Edit username\", \"كلمة سر جديدة للفريق\": \"New password for the Team\", \"اكتبها بنفسك أو دوس توليد. بتظهر مرة واحدة بس، ابعتها للفريق بنفسك.\": \"Type one yourself or tap Generate. It is shown once only; send it to the Team yourself.\", \"بيانات دخول الفريق (بتظهر مرة واحدة، ابعتها للفريق بنفسك)\": \"Team sign-in details (shown once, send them to the Team yourself)\", \"كل فريق ليه يوزر وكلمة سر واحدين، أي حد معاه بيدخل ويستخدم كويزات الفريق.\": \"Each Team has one username and one password. Anyone who has them signs in and uses the Team quizzes.\", \"إنشاء الفريق\": \"Create Team\", \"مفيش يوزر لسه\": \"No login yet\", \"يوزر وكلمة سر الفريق\": \"Team username and password\", \"كلمة السر متخزنة مشفرة ومش ممكن تتعرض. لو اتنسيت اعمل واحدة جديدة.\": \"The password is stored encrypted and can never be shown. If it is forgotten, make a new one.\", \"الفريق ده لسه ملوش يوزر. اعمله واحد.\": \"This Team has no login yet. Create one.\", \"الأحسن: غيّر الاسم أو اليوزر بدل الحذف.\": \"Better: rename the Team or change the username instead of deleting.\", \"دخول الفريق\": \"Team sign-in\", \"بيانات الدخول بتطلبها من الأدمن.\": \"Ask the Admin for the sign-in details.\"});\nObject.assign(EN,{\"اليوزر أو الإيميل\": \"Username or email\", \"توليد\": \"Generate\", \"تعديل المدرب\": \"Edit trainer\", \"كلمة سر جديدة للمدرب\": \"New password for the trainer\", \"اكتبها بنفسك أو دوس توليد. بتظهر مرة واحدة بس، ابعتها للمدرب بنفسك.\": \"Type one yourself or tap Generate. It is shown once only; hand it to the trainer yourself.\", \"اتحفظ\": \"Saved\", \"بيانات الدخول (بتظهر مرة واحدة)\": \"Sign-in details (shown once)\", \"تم\": \"Done\", \"حذف المدرب؟\": \"Delete this trainer?\", \"الكويزات والسجل بتفضل في الفريق ومش بتتمسح.\": \"Quizzes and History stay with the Team and are not erased.\", \"حذف الفريق؟\": \"Delete this Team?\", \"ده هيمسح كل كويزات الفريق وسجله. اكتب اسم الفريق للتأكيد.\": \"This erases all the Team quizzes and History. Type the Team name to confirm.\", \"الأحسن: غيّر الاسم وضيف مدرب بدل الحذف.\": \"Better: rename it and add a trainer instead of deleting.\", \"حذف الفريق\": \"Delete Team\", \"حذف\": \"Delete\", \"تعديل\": \"Edit\", \"إلغاء\": \"Cancel\", \"أنشئ\": \"Created\", \"حروف وأرقام ونقطة وشرطة (3 على الأقل)، أو إيميل. لازم يكون مختلف عن أي حساب تاني. كلمة السر 6 حروف على الأقل.\": \"Letters, digits, dot, dash (3 or more), or an email. Must be unique. Password: 6 characters or more.\", \"المدرب بيختار اليوزر وكلمة السر بنفسه.\": \"The trainer picks their own username and password.\", \"اكتب يوزر (حروف وأرقام ونقطة وشرطة، 3 على الأقل) أو إيميل صحيح.\": \"Enter a username (letters, digits, dot, dash, 3 or more) or a valid email.\", \"اليوزر أو الإيميل ده مستخدم بالفعل.\": \"That username or email is already in use.\", \"اكتب اسم الفريق بالظبط للتأكيد.\": \"Type the Team name exactly to confirm.\", \"الحساب مش موجود.\": \"Account not found.\"});\nObject.assign(EN,{\"المكتبة\":\"Library\",\"السجل\":\"History\",\"تصدير الكل Excel\":\"Export all (Excel)\",\"ابحث بالاسم\":\"Search by name\",\"كل الفصول\":\"All classes\",\"اسم الفصل أو المجموعة (مطلوب)\":\"Class or group name (required)\",\"مثال: دفعة 12\":\"e.g. Batch 12\",\"اكتب اسم الفصل أو المجموعة.\":\"Enter the class or group name.\",\"اكتب اسم الفصل أو المجموعة (لحد ٦٠ حرف).\":\"Enter the class or group name (up to 60 characters).\",\"شغّل الموسيقى\":\"Turn music on\",\"وقف الموسيقى\":\"Turn music off\",\n\"تسجيل دخول المدربين\":\"Trainer sign-in\",\"الإيميل\":\"Email\",\"كلمة السر\":\"Password\",\"ادخل\":\"Sign in\",\"الإيميل أو كلمة السر غلط.\":\"Wrong email or password.\",\"اكتب إيميل صحيح.\":\"Enter a valid email.\",\"كلمة السر من ٦ لـ ٦٤ حرف أو رقم.\":\"Password must be 6 to 64 characters.\",\"سجّل الدخول الأول.\":\"Sign in first.\",\"سجّل الدخول تاني.\":\"Sign in again.\",\"الجلسة انتهت. سجّل الدخول تاني.\":\"Your session expired. Sign in again.\",\"الحساب ده موقوف.\":\"This account is suspended.\",\"الإيميل ده مستخدم بالفعل.\":\"This email is already used.\",\"اللينك ده انتهى أو اتستخدم.\":\"This link expired or was already used.\",\"الأدمن بيشوف بيانات الفريق للقراءة بس.\":\"Admin views Team data read-only.\",\"ادخل بحساب الأدمن.\":\"Sign in as Admin.\",\"اختار فريق الأول.\":\"Pick a Team first.\",\"محاولات كتير غلط. استنى ١٥ دقيقة وجرّب تاني.\":\"Too many wrong attempts. Wait 15 minutes.\",\"حساب الأدمن متحدد بالفعل.\":\"The Admin account is already set.\",\"اسم الفريق لحد ٦٠ حرف.\":\"Team name up to 60 characters.\",\"الفريق مش موجود.\":\"Team not found.\",\"الحساب مش موجود.\":\"Account not found.\",\n\"الفريق\":\"Team\",\"أنشئ حسابك\":\"Create your account\",\"هتدخل فريق\":\"You are joining\",\"أنشئ الحساب\":\"Create account\",\"الحسابات بتتعمل بدعوة من الأدمن بس.\":\"Accounts are created by invitation from the Admin only.\",\"الأدمن\":\"Admin\",\"فرق\":\"Teams\",\"الفرق\":\"Teams\",\"فريق جديد\":\"New Team\",\"اسم الفريق\":\"Team name\",\"تغيير الاسم\":\"Rename\",\"إنشاء\":\"Create\",\"الإحصائيات\":\"Statistics\",\"رجوع للفرق\":\"Back to Teams\",\"فتح\":\"Open\",\"لينك دعوة (24 ساعة)\":\"Invite link (24 hours)\",\"اعمل لينك\":\"Create link\",\"اللينك شغال ٢٤ ساعة ولمرة واحدة. انسخه وابعته.\":\"The link works for 24 hours, once. Copy and send it.\",\"حساب جديد\":\"New account\",\"إنشاء حساب\":\"Create account\",\"إعادة تعيين كلمة السر\":\"Reset password\",\"وقف\":\"Suspend\",\"تفعيل\":\"Activate\",\"شوف بيانات الفريق (قراءة فقط)\":\"View Team data (read-only)\",\"مدربين\":\"Trainers\",\"كويزات\":\"Quizzes\",\"ألعاب\":\"Games\",\"أونلاين دلوقتي\":\"Online now\",\"لاعبين\":\"Players\",\"أونلاين لكل فريق\":\"Online per Team\",\"الناس في اليوم (آخر 14 يوم)\":\"People per day (last 14 days)\",\"أول مرة: اعمل حساب الأدمن\":\"First time: create the Admin account\",\"احفظ\":\"Save\",\"تم النسخ\":\"Copied\",\"كلمة سر جديدة\":\"New password\",\"أنت بتشوف بيانات الفريق للقراءة بس\":\"You are viewing this Team read-only\",\"خروج الأدمن\":\"Admin sign out\",\"بيانات الفريق\":\"Team data\"});\nObject.assign(EN,{\"دخول الفريق\":\"Team sign-in\",\"دخول الأدمن\":\"Admin sign-in\",\"كأدمن\":\"As Admin\",\"كفريق\":\"As Team\"});\nObject.assign(Q,{team:null,sys:null,systeam:null,hq:'',hc:''});\ntry{Q.sys=localStorage.getItem('quiz.sys')}catch{}\nfunction qrecent(){try{return JSON.parse(localStorage.getItem('quiz.cls')||'[]').slice(0,6)}catch{return[]}}\nfunction qremember(c){try{const a=[c,...qrecent().filter(x=>x!==c)].slice(0,6);localStorage.setItem('quiz.cls',JSON.stringify(a))}catch{}}\nfunction qtabs(a){return '<div class=\"qrow qtabs\" style=\"gap:8px;margin-bottom:10px\"><button class=\"secondary\" data-tab=\"lib\" aria-pressed=\"'+(a==='lib')+'\">'+t('المكتبة')+'</button><button class=\"secondary\" data-tab=\"hist\" aria-pressed=\"'+(a==='hist')+'\">'+t('السجل')+'</button>'+(Q.team?'<small class=\"muted\" style=\"margin-inline-start:auto\">'+esc(Q.team.name)+'</small>':'')+'</div>'}\nfunction qtabsBind(){document.querySelectorAll('.qtabs button[data-tab]').forEach(b=>b.onclick=async()=>{try{if(b.dataset.tab==='hist'){Q.hist=await qapi('/history',null,Q.tok);Q.histOpen=null;Q.view='hist'}else Q.view='lib';qrender()}catch(e){qerr(e)}})}\n/* ---- trainer sign-in and invite ---- */\nasync function sapi(p,body,tok,team){const r=await fetch(apiOrigin+'/api/quiz'+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(tok?{Authorization:'Bearer '+tok}:{}),...(team?{'X-Team':team}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});let d;try{d=await r.json()}catch{throw new Error(t('تعذّر الاتصال بالخدمة. اتأكد من الإنترنت وجرّب تاني.'))}if(!r.ok)throw new Error(t(d.error||'حصل خطأ.'));return d}\nfunction qinviteTok(){return new URLSearchParams(location.search).get('invite')}\nasync function authView(r){const inv=qinviteTok();let team='';\n if(inv){try{team=(await sapi('/invite/info?t='+encodeURIComponent(inv))).team}catch(e){r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><div class=\"qglass\"><p>'+esc(e.message)+'</p></div>';return}}\n r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><h2>'+t(inv?'أنشئ حسابك':'ادخل')+'</h2>'+(inv?'':'<div class=\"qlanding\" role=\"group\"><button id=\"qlad\" type=\"button\" aria-pressed=\"'+(Q.pick==='admin')+'\"><b>'+t('كأدمن')+'</b></button><button id=\"qlteam\" type=\"button\" aria-pressed=\"'+(Q.pick!=='admin')+'\"><b>'+t('كفريق')+'</b></button></div>')+'<div class=\"qglass\">'+(inv?'<p>'+t('هتدخل فريق')+': <b dir=\"auto\">'+esc(team)+'</b></p>':'')+'<div class=\"fields\"><div><label for=\"qem\">'+t('اليوزر أو الإيميل')+'</label><input id=\"qem\" type=\"text\" autocomplete=\"username\" autocapitalize=\"off\" dir=\"ltr\"></div><div><label for=\"qpass\">'+t('كلمة السر')+'</label><input id=\"qpass\" type=\"password\" autocomplete=\"'+(inv?'new-password':'current-password')+'\"></div></div><div class=\"actions\"><button id=\"qauth\">'+t(inv?'أنشئ الحساب':'ادخل')+'</button>'+'</div></div>';\n const go=async()=>{try{if(!inv&&Q.pick==='admin'){let sc=true;try{sc=(await sapi('/admin/status')).sysConfigured}catch{}const d=await sapi(sc?'/sys/login':'/sys/setup',{email:$('qem').value,password:$('qpass').value});sysSet(d.token);Q.pick=null;Q.view='sys-teams';qrender();return}const d=await sapi(inv?'/invite/accept':'/login',{email:$('qem').value,password:$('qpass').value,token:inv},null);qsetTok(d.token);Q.team=d.team;Q.pick=null;if(inv)history.replaceState(null,'',location.pathname);const l=await qapi('/library',null,d.token);Q.lib=l.quizzes;Q.view='lib';qrender()}catch(e){error(e)}};\n $('qauth').onclick=go;if(!inv){const sw=k=>()=>{const e=$('qem').value,w=$('qpass').value;Q.pick=k;authView(r).then(()=>{$('qem').value=e;$('qpass').value=w})};$('qlad').onclick=sw('admin');$('qlteam').onclick=sw('team')}$('qpass').onkeydown=e=>{if(e.key==='Enter')go()}}\n{const o=openQuiz;}\n/* ---- Admin (standalone page, footer link) ---- */\nfunction sysSet(v){Q.sys=v;try{v?localStorage.setItem('quiz.sys',v):localStorage.removeItem('quiz.sys')}catch{}}\nasync function openSys(){show('quiz');Q.view='sys-login';if(Q.sys){try{await sapi('/sys/teams',null,Q.sys);Q.view='sys-teams'}catch{sysSet(null)}}\n if(Q.view==='sys-login'){Q.pick='admin';Q.view='auth'}qrender()}\nfunction toTeam(){try{history.replaceState(null,'',location.pathname+location.search)}catch{}openQuiz()}\nfunction toAdmin(){try{history.replaceState(null,'',location.pathname+location.search+'#admin')}catch{}openSys()}\nfunction sysHead(a){return '<span class=\"eyebrow\">'+t('الأدمن')+'</span><div class=\"qrow\" style=\"gap:8px;margin-bottom:10px;justify-content:space-between\"><h2 style=\"margin:0\">'+t('الفرق')+'</h2><span class=\"qrow\" style=\"gap:6px\"><button class=\"secondary\" data-s=\"team\">'+t('دخول الفريق')+'</button><button class=\"secondary\" data-s=\"out\">'+t('خروج الأدمن')+'</button></span></div>'}\nfunction sysBind(r){r.querySelectorAll('button[data-s]').forEach(b=>b.onclick=()=>{if(b.dataset.s==='out'){sysSet(null);Q.pick='team';toTeam();return}if(b.dataset.s==='team'){Q.pick='team';toTeam();return}Q.view=b.dataset.s;sysRender(r)})}\nasync function sysRender(r){const v=Q.view;try{\n if(v==='sys-login'){const setup=Q.sysConf===false;r.innerHTML='<span class=\"eyebrow\">'+t('الأدمن')+'</span><h2>'+t(setup?'أول مرة: اعمل حساب الأدمن':'الأدمن')+'</h2><div class=\"qglass\"><div class=\"fields\"><div><label for=\"sem\">'+t('اليوزر أو الإيميل')+'</label><input id=\"sem\" type=\"text\" dir=\"ltr\" autocomplete=\"username\" autocapitalize=\"off\"></div><div><label for=\"spw\">'+t('كلمة السر')+'</label><input id=\"spw\" type=\"password\" autocomplete=\"'+(setup?'new-password':'current-password')+'\"></div></div><div class=\"actions\"><button id=\"sgo\">'+t(setup?'احفظ':'ادخل')+'</button><button class=\"secondary\" id=\"sgt\">'+t('دخول الفريق')+'</button></div></div>';\n  const go=async()=>{try{const d=await sapi(setup?'/sys/setup':'/sys/login',{email:$('sem').value,password:$('spw').value});sysSet(d.token);Q.view='sys-teams';sysRender(r)}catch(e){error(e)}};$('sgo').onclick=go;$('sgt').onclick=()=>{Q.pick='team';toTeam()};$('spw').onkeydown=e=>{if(e.key==='Enter')go()};return}\n const gen=()=>{const A='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',a=new Uint32Array(12);crypto.getRandomValues(a);return [...a].map(x=>A[x%A.length]).join('')};\n const btn=(c,id,tx)=>'<button class=\"'+c+'\" id=\"'+id+'\">'+t(tx)+'</button>';\n const doneBox=D=>'<div class=\"qglass\" id=\"pn\" style=\"border:2px solid #e60000\"><h3>'+t('اتحفظ')+(D.name?' · <span dir=\"auto\">'+esc(D.name)+'</span>':'')+'</h3><p class=\"muted\">'+t('بيانات دخول الفريق (بتظهر مرة واحدة، ابعتها للفريق بنفسك)')+'</p><label>'+t('اليوزر أو الإيميل')+'</label><input readonly dir=\"ltr\" value=\"'+esc(D.email)+'\" onclick=\"this.select()\"><label>'+t('كلمة السر')+'</label><input readonly dir=\"ltr\" value=\"'+esc(D.pw)+'\" onclick=\"this.select()\"><div class=\"actions\">'+btn('secondary','pcx','تم')+'</div></div>';\n if(v==='sys-teams'){const d=await sapi('/sys/teams',null,Q.sys);const D=Q.sysDone,P=Q.sysPanel&&d.teams.find(x=>x.id===Q.sysPanel.id)?Q.sysPanel:null,PT=P?d.teams.find(x=>x.id===P.id):null;\n  let panel='';\n  if(D)panel=doneBox(D);\n  if(P&&P.type==='reset')panel='<div class=\"qglass\" id=\"pn\" style=\"border:2px solid #e60000\"><h3>'+t('كلمة سر جديدة')+' · <span dir=\"auto\">'+esc(PT.name)+'</span></h3>'+(PT.login?'<p dir=\"ltr\" style=\"text-align:start\"><b>'+esc(PT.login)+'</b></p>':'<label>'+t('اليوزر أو الإيميل')+'</label><input id=\"pu\" dir=\"ltr\" autocomplete=\"off\" autocapitalize=\"off\">')+'<div class=\"qrow\" style=\"gap:8px;margin-top:8px\"><input id=\"pv\" dir=\"ltr\" autocomplete=\"off\" style=\"flex:1\">'+btn('secondary','pg','توليد')+'</div><p class=\"muted\">'+t('بتظهر مرة واحدة بس، ابعتها للفريق بنفسك.')+'</p><div class=\"actions\">'+btn('','pok','احفظ')+btn('secondary','pcx','إلغاء')+'</div></div>';\n  if(P&&P.type==='del')panel='<div class=\"qglass\" id=\"pn\" style=\"border:2px solid #e60000\"><h3>'+t('حذف الفريق؟')+' · <span dir=\"auto\">'+esc(PT.name)+'</span></h3><p>'+t('ده هيمسح كل كويزات الفريق وسجله. اكتب اسم الفريق للتأكيد.')+' ('+PT.quizzes+' '+t('كويزات')+' · '+PT.games+' '+t('ألعاب')+')</p><input id=\"dtn\" autocomplete=\"off\" placeholder=\"'+esc(PT.name)+'\"><div class=\"actions\"><button class=\"qbtn-danger\" id=\"dtok\" disabled>'+t('حذف الفريق')+'</button>'+btn('secondary','pcx','إلغاء')+'</div></div>';\n  r.innerHTML=sysHead('teams')+panel+'<div class=\"qglass\"><h3>'+t('فريق جديد')+'</h3><div class=\"fields\"><div><label>'+t('اسم الفريق')+'</label><input id=\"ntn\" maxlength=\"60\" autocomplete=\"off\"></div><div><label>'+t('اليوزر أو الإيميل')+'</label><input id=\"nte\" dir=\"ltr\" autocomplete=\"off\" autocapitalize=\"off\"></div><div><label>'+t('كلمة السر')+'</label><div class=\"qrow\" style=\"gap:8px\"><input id=\"ntp\" type=\"text\" dir=\"ltr\" autocomplete=\"off\" style=\"flex:1\">'+btn('secondary','ntg','توليد')+'</div></div></div><div class=\"actions\"><button id=\"ntc\">'+t('إنشاء الفريق')+'</button></div></div><h3 style=\"margin:14px 4px 6px\">'+t('الفرق')+' ('+d.teams.length+')</h3><div id=\"tl\">'+d.teams.map(x=>'<div class=\"qitem\" data-id=\"'+esc(x.id)+'\"><span><b dir=\"auto\">'+esc(x.name)+'</b><small dir=\"ltr\" style=\"text-align:start\">'+(x.login?esc(x.login):t('مفيش يوزر لسه'))+'</small></span><span class=\"qrow\" style=\"flex-wrap:wrap;gap:6px\"><button class=\"secondary\" data-a=\"reset\">'+t('كلمة سر جديدة')+'</button><button class=\"secondary qbtn-danger\" data-a=\"del\">'+t('حذف')+'</button></span></div>').join('')+'</div>';sysBind(r);\n  $('ntg').onclick=()=>{$('ntp').value=gen()};\n  if($('pcx'))$('pcx').onclick=()=>{Q.sysDone=null;Q.sysPanel=null;sysRender(r)};\n  if($('pg'))$('pg').onclick=()=>{$('pv').value=gen()};\n  $('ntc').onclick=async()=>{try{const nm=$('ntn').value,em=$('nte').value,pw=$('ntp').value;const x=await sapi('/sys/teams/create',{name:nm,email:em,password:pw},Q.sys);Q.sysPanel=null;Q.sysDone={name:nm.trim(),email:x.login||em.trim().toLowerCase(),pw};sysRender(r)}catch(e){error(e)}};\n  $('tl').onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;Q.sysDone=null;Q.sysPanel={type:b.dataset.a,id:b.closest('.qitem').dataset.id};sysRender(r)};\n  if($('dtn')){$('dtn').oninput=()=>{$('dtok').disabled=$('dtn').value.trim()!==PT.name};$('dtok').onclick=async()=>{try{await sapi('/sys/teams/delete',{id:PT.id,name:$('dtn').value},Q.sys);Q.sysPanel=null;sysRender(r)}catch(e){error(e)}}}\n  if($('pok'))$('pok').onclick=async()=>{try{const pw=$('pv').value;let em=PT.login;if(PT.login){const ac=await sapi('/sys/accounts?team='+encodeURIComponent(PT.id),null,Q.sys);await sapi('/sys/accounts/reset',{id:ac.accounts[0].id,password:pw},Q.sys)}else{em=$('pu').value.trim().toLowerCase();await sapi('/sys/accounts/create',{team:PT.id,email:em,password:pw},Q.sys)}Q.sysPanel=null;Q.sysDone={name:PT.name,email:em,pw};sysRender(r)}catch(e){error(e)}};\n  return}\n if(v==='sys-view'){const w=Q.vw;r.innerHTML=sysHead('teams')+'<div class=\"notice\"><p>'+t('أنت بتشوف بيانات الفريق للقراءة بس')+'</p></div><div class=\"qrow between\"><h2>'+t('بيانات الفريق')+'</h2><button class=\"secondary\" id=\"vb\">'+t('رجوع')+'</button></div><div class=\"qglass\"><h3>'+t('المكتبة')+' ('+w.l.length+')</h3>'+w.l.map(x=>'<div class=\"qitem\"><span><b dir=\"auto\">'+esc(x.title)+'</b><small>'+x.count+' '+t('سؤال')+'</small></span></div>').join('')+'</div><div class=\"qglass\"><h3>'+t('السجل')+' ('+w.h.length+')</h3>'+w.h.map(g=>'<div class=\"qitem\" data-c=\"'+esc(g.code)+'\"><span><b dir=\"auto\">'+esc(g.title)+'</b><small>'+(g.cls?esc(g.cls)+' · ':'')+qdt(g.ended)+' · '+g.players+' '+t('لاعب')+'</small></span><span class=\"qrow\"><button class=\"secondary\" data-g=\"open\">'+t('تفاصيل')+'</button><button class=\"secondary\" data-g=\"csv\">CSV</button></span></div>').join('')+'</div><div id=\"gd\"></div>';sysBind(r);\n  r.onclick=async e=>{const b=e.target.closest('button[data-g]');if(!b)return;const code=b.closest('.qitem').dataset.c;try{const d=await sapi('/history/'+code,null,Q.sys,Q.adminTeam),rp=d.report;if(b.dataset.g==='csv')return qdownload(reportCSV(rp,d.ended),(rp.title||'results')+'.csv');$('gd').innerHTML='<div class=\"qglass\"><h3 dir=\"auto\">'+esc(rp.title)+'</h3><div class=\"qlb\">'+rp.players.map(p=>'<div class=\"r\"><span>'+p.rank+'. <bdi dir=\"auto\">'+esc(p.name)+'</bdi></span><span>'+fmtp(p.score)+'</span></div>').join('')+'</div></div>';$('gd').scrollIntoView({behavior:'smooth'})}catch(er){error(er)}};$('vb').onclick=()=>{Q.view='sys-team';sysRender(r)};return}\n if(v==='sys-stats'){const d=await sapi('/sys/stats',null,Q.sys);const days=[];for(let i=13;i>=0;i--)days.push(new Date(Date.now()-i*86400000).toISOString().slice(0,10));const m=Object.fromEntries(d.daily.map(x=>[x.day,x.players+x.trainers])),mx=Math.max(1,...days.map(x=>m[x]||0));\n  r.innerHTML=sysHead('stats')+'<h2>'+t('الإحصائيات')+'</h2><div class=\"qstats\"><div class=\"qsc\"><span><b style=\"font-size:26px\">'+(d.players+d.trainers)+'</b><br><small>'+t('أونلاين دلوقتي')+'</small></span></div><div class=\"qsc\"><span><b style=\"font-size:26px\">'+d.trainers+'</b><br><small>'+t('مدربين')+'</small></span></div><div class=\"qsc\"><span><b style=\"font-size:26px\">'+d.players+'</b><br><small>'+t('لاعبين')+'</small></span></div></div><div class=\"qglass\"><h3>'+t('أونلاين لكل فريق')+'</h3>'+d.teams.map(x=>'<div class=\"qitem\"><span><b dir=\"auto\">'+esc(x.name)+'</b><small>'+x.trainers+' '+t('مدربين')+' · '+x.players+' '+t('لاعبين')+'</small></span><b>'+(x.players+x.trainers)+'</b></div>').join('')+'</div><div class=\"qglass\"><h3>'+t('الناس في اليوم (آخر 14 يوم)')+'</h3><div style=\"display:flex;gap:6px;align-items:flex-end;height:220px\">'+days.map(x=>'<div style=\"flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px\"><small>'+(m[x]||'')+'</small><div style=\"width:100%;height:'+Math.round((m[x]||0)/mx*170)+'px;background:linear-gradient(#ff4357,#c20018);border-radius:6px 6px 0 0\"></div><small>'+x.slice(8)+'</small></div>').join('')+'</div></div>';sysBind(r)}\n}catch(e){if(/انتهت|سجّل|ادخل بحساب/.test(e.message)){sysSet(null);Q.view='sys-login'}error(e)}}\n(function(){ const chk=()=>{if(location.hash==='#admin')openSys()};addEventListener('hashchange',chk);setTimeout(chk,400);\n if(qinviteTok())setTimeout(()=>{try{$('quizTab').click()}catch{}},500)})();\n\n/* ===== QUIZ UI2: header, home, avatars sprite, validation toast ===== */\nObject.assign(EN,{\"اعمل كويز\":\"Create a quiz\",\"ابدأ لعبة مباشرة\":\"Host a live game\",\"ادخل بكود\":\"Join with a code\",\"آخر الكويزات\":\"Recent quizzes\",\"إحصائيات سريعة\":\"Quick stats\",\"ألعاب اتعملت\":\"Games hosted\",\"إجمالي المشاركين\":\"Total participants\",\"متوسط اللاعبين في اللعبة\":\"Avg players per game\",\"كويزات محفوظة\":\"Saved quizzes\",\"اعمل كويز الأول\":\"Create a quiz first\",\"اكتب اسم الكويز\":\"Write the quiz name\",\"أضف سؤال واحد\":\"Add one question\",\"في سؤال من غير نص\":\"A question has no text\",\"في اختيار فاضي\":\"An option is empty\"});\n/* avatar sprite */\ndocument.body.insertAdjacentHTML('beforeend','<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\">'+QAV_SYMBOLS+'</svg>');\n/* validation notice */\n{const M={'اكتب اسم الكويز.':'اكتب اسم الكويز','أضف سؤال واحد على الأقل.':'أضف سؤال واحد','اكتب نص كل سؤال.':'في سؤال من غير نص','كمّل اختيارات كل سؤال.':'في اختيار فاضي'};\nconst _qe=qerr;qerr=function(e){if(role==='quiz'&&Q.view==='edit'&&e&&e.message){for(const k in M){if(e.message===t(k)){$('globalError').textContent='';qtoast(t(M[k]));return}}}_qe(e)}}\n/* home decoration on the quiz library */\nconst QH_ICON={mc:'<path d=\"M4 6h16M4 12h16M4 18h16\"/>',spot:'<circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"M16 16l5 5\"/>',cloud:'<path d=\"M7 18a4 4 0 010-8 5 5 0 019.5-1A3.5 3.5 0 0117 18z\"/>'};\nconst qsvg=(p,c)=>'<svg class=\"'+(c||'')+'\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">'+p+'</svg>';\nlet qstat=null,qstatAt=0;\nfunction qhome(){const r=$('quizRoot');if(!r||r.querySelector('.qhero'))return;\n const hero='<div class=\"qhero\" role=\"img\" aria-label=\"RoomPulse\"></div><div class=\"qbtns\"><button type=\"button\" class=\"qbt w\" id=\"qh1\"><span class=\"qbi\">'+qsvg('<path d=\"M12 5v14M5 12h14\"/>')+'</span><b>'+t('اعمل كويز')+'</b></button><button type=\"button\" class=\"qbt r\" id=\"qh2\"><span class=\"qbi\">'+qsvg('<path d=\"M7 4l13 8-13 8z\"/>')+'</span><b>'+t('ابدأ لعبة مباشرة')+'</b></button><button type=\"button\" class=\"qbt d\" id=\"qh3\"><span class=\"qbi\">'+qsvg('<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M17 11l4 3-4 3\"/>')+'</span><b>'+t('ادخل بكود')+'</b></button></div>';\n const first=r.firstChild;r.insertAdjacentHTML('afterbegin',hero);\n $('qh1').onclick=()=>{const b=$('qnew');if(b)b.click()};\n $('qh2').onclick=()=>{if($('qresume')){$('qresume').click();return}const b=r.querySelector('#qlist [data-a=run]');if(b)b.click();else qtoast(t('اعمل كويز الأول'))};\n $('qh3').onclick=()=>{location.href=joinPath+(lang?'?lang='+lang:'')};\n r.querySelectorAll('#qlist .qitem').forEach((el,i)=>{const x=Q.lib[i];if(!x)return;const ty=x.types&&x.types.length===1?x.types[0]:'mc';el.insertAdjacentHTML('afterbegin','<span class=\"qtile\">'+qsvg(QH_ICON[ty]||QH_ICON.mc)+'</span>')});\n const box=document.createElement('div');box.id='qstats';r.appendChild(box);qstatsRender();\n if(Date.now()-qstatAt>60000||!qstat){qstatAt=Date.now();qapi('/history',null,Q.tok).then(d=>{qstat=d;qstatsRender()}).catch(()=>{})}}\nfunction qstatsRender(){const b=$('qstats');if(!b)return;const g=qstat&&qstat.games||[];const total=qstat?(qstat.total!=null?qstat.total:g.length):0;const ppl=g.reduce((a,x)=>a+(x.players||0),0);\n const cells=[['game',total,'ألعاب اتعملت'],['ppl',ppl,'إجمالي المشاركين'],['chk',g.length?Math.round(ppl/g.length):0,'متوسط اللاعبين في اللعبة'],['cup',Q.lib.length,'كويزات محفوظة']];\n const IC={game:'<rect x=\"3\" y=\"7\" width=\"18\" height=\"11\" rx=\"5\"/><path d=\"M8 10v5M5.5 12.5h5\"/>',ppl:'<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M16 5a3.5 3.5 0 010 7M18 14c2.5.6 3.5 2.6 3.5 6\"/>',chk:'<rect x=\"4\" y=\"12\" width=\"4\" height=\"8\" rx=\"1\"/><rect x=\"10\" y=\"5\" width=\"4\" height=\"15\" rx=\"1\"/><rect x=\"16\" y=\"9\" width=\"4\" height=\"11\" rx=\"1\"/>',cup:'<path d=\"M7 4h10v5a5 5 0 01-10 0zM7 6H3c0 3 1.5 4 4 4M17 6h4c0 3-1.5 4-4 4M12 14v4M8 20h8\"/>'};\n b.innerHTML='<h3>'+t('إحصائيات سريعة')+'</h3><div class=\"qstats\">'+cells.map(c=>'<div class=\"qsc\"><span class=\"qsi\">'+qsvg(IC[c[0]])+'</span><div><b>'+c[1]+'</b><small>'+t(c[2])+'</small></div></div>').join('')+'</div>'}\n{const _qr2=qrender;qrender=function(){_qr2();if(role==='quiz'&&Q.view==='lib')qhome()}}\n\nObject.assign(EN,{\"تواصل\": \"Contact\", \"تواصل مع صانع الموقع\": \"Contact the creator\", \"عمر ناجي\": \"Omar Nagy\", \"ع\": \"O\", \"الموبايل\": \"Mobile\", \"الإيميل\": \"Email\", \"صانع RoomPulse\": \"Creator of RoomPulse\"});$('contactTab').onclick=()=>show('contact');\ndocument.querySelectorAll('a[href=\"/\"]').forEach(a=>a.href=appBase);document.querySelectorAll('a[href=\"/join\"]').forEach(a=>a.href=joinPath);\n\nfunction moveSectionPill(){requestAnimationFrame(()=>{const nav=document.querySelector('.section-tabs'),active=nav.querySelector('[aria-pressed=\"true\"]');if(!active||nav.classList.contains('hidden'))return;nav.style.setProperty('--pill-x',active.offsetLeft+'px');nav.style.setProperty('--pill-y',active.offsetTop+'px');nav.style.setProperty('--pill-w',active.offsetWidth+'px');nav.style.setProperty('--pill-h',active.offsetHeight+'px')})}\nconst sectionNavObserver=new ResizeObserver(moveSectionPill);sectionNavObserver.observe(document.querySelector('.section-tabs'));for(const button of document.querySelectorAll('.section-tabs button'))sectionNavObserver.observe(button);document.fonts.ready.then(moveSectionPill);window.addEventListener('resize',moveSectionPill);\n\nif(location.pathname==='/join'||location.pathname===appBase+'join/'||location.pathname===appBase+'join/index.html'){show('join');const code=new URLSearchParams(location.search).get('code');if(code){$('joinCode').value=code;quizTryJoin()}}else{show('welcome');$('resumeBox').classList.toggle('hidden',!saved())}\n\n$('langAR').onclick=()=>setLanguage('ar');$('langEN').onclick=()=>setLanguage('en');applyLanguage();renderBank();setIdentity(identity);setMode(mode);\n</script></body></html>\n";
const schema = [
`CREATE TABLE IF NOT EXISTS ranking_rounds (code TEXT PRIMARY KEY, ended INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS ranking_sessions (code TEXT PRIMARY KEY, started INTEGER NOT NULL, correct INTEGER, group_code TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ranking_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, client TEXT NOT NULL, choice INTEGER NOT NULL, received INTEGER NOT NULL, UNIQUE(code,client))`,
`CREATE INDEX IF NOT EXISTS ranking_answers_code ON ranking_answers(code,received,id)`,
`CREATE TABLE IF NOT EXISTS session_timers (code TEXT PRIMARY KEY, duration INTEGER NOT NULL, ends_at INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, token TEXT NOT NULL, title TEXT NOT NULL, question TEXT NOT NULL, options TEXT NOT NULL, open INTEGER NOT NULL DEFAULT 1, expires INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS votes (code TEXT NOT NULL, client TEXT NOT NULL, choice INTEGER NOT NULL, PRIMARY KEY(code,client))`,
`CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires)`,
`CREATE TABLE IF NOT EXISTS session_modes (code TEXT PRIMARY KEY, mode TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS text_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, client TEXT NOT NULL, answer TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE(code,client))`,
`CREATE INDEX IF NOT EXISTS answers_code ON text_answers(code,id)`,
`CREATE TABLE IF NOT EXISTS session_identity (code TEXT PRIMARY KEY, identity TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS participant_names (code TEXT NOT NULL, client TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(code,client))`
];
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function body(req){const t=await req.text();if(t.length>8192)fail('حجم الطلب أكبر من المسموح.');try{return JSON.parse(t)}catch{fail('بيانات الطلب غير صحيحة.')}}
function clean(s,n){if(typeof s!=='string'||!s.trim()||s.trim().length>n)fail('كمّل السؤال والاختيارات، والتزم بالطول المسموح.');return s.trim()}

async function roundScores(db,groupCode,identity){
const rows=await db.prepare('SELECT a.id,a.client,a.choice,a.received,r.code,r.started,r.correct,n.name FROM ranking_answers a JOIN ranking_sessions r ON r.code=a.code LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE r.group_code=? ORDER BY a.id').bind(groupCode).all();
const players=new Map();for(const a of rows.results){if(!players.has(a.client))players.set(a.client,{participant:players.size+1,...(identity==='named'?{name:a.name||''}:{}),points:0,correctAnswers:0,answers:0});players.get(a.client).answers++;}
const codes=[...new Set(rows.results.map(a=>a.code))];for(const code of codes){const eligible=rows.results.filter(a=>a.code===code&&(a.correct===null||a.choice===a.correct)).sort((a,b)=>a.received-b.received||a.id-b.id);let previous=null,rank=0;eligible.forEach((a,i)=>{if(a.received!==previous)rank=i+1;previous=a.received;const p=players.get(a.client);p.points+=Math.max(1,Math.floor(1000/rank));p.correctAnswers++;});}
const list=[...players.values()].sort((a,b)=>b.points-a.points||a.participant-b.participant);let previous=null,rank=0;return list.map((p,i)=>{if(p.points!==previous)rank=i+1;previous=p.points;return {...p,rank}});
}

// ===== QUIZ MODULE (added 2026-11-24): admin quiz library + live quiz games under /api/quiz/*. Existing routes are untouched. =====
const QSCHEMA=[
`CREATE TABLE IF NOT EXISTS quiz_admin (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, hash TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_admin_tokens (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_library (id TEXT PRIMARY KEY, title TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_games (code TEXT PRIMARY KEY, token TEXT NOT NULL, quiz TEXT NOT NULL, teams INTEGER NOT NULL, state TEXT NOT NULL, qi INTEGER NOT NULL, q_start INTEGER NOT NULL, q_end INTEGER NOT NULL, expires INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_players (code TEXT NOT NULL, client TEXT NOT NULL, name TEXT NOT NULL, team INTEGER NOT NULL, score INTEGER NOT NULL DEFAULT 0, joined INTEGER NOT NULL, PRIMARY KEY(code,client))`,
`CREATE TABLE IF NOT EXISTS quiz_answers (code TEXT NOT NULL, qi INTEGER NOT NULL, client TEXT NOT NULL, choice INTEGER, text TEXT, ms INTEGER NOT NULL, points INTEGER NOT NULL, ok INTEGER NOT NULL, PRIMARY KEY(code,qi,client))`,
`CREATE TABLE IF NOT EXISTS quiz_history (code TEXT PRIMARY KEY, title TEXT NOT NULL, ended INTEGER NOT NULL, teams INTEGER NOT NULL, players INTEGER NOT NULL, top TEXT NOT NULL, data TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL, suspended INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_accounts (id TEXT PRIMARY KEY, team TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, suspended INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_sessions (hash TEXT PRIMARY KEY, role TEXT NOT NULL, account TEXT NOT NULL, team TEXT NOT NULL, expires INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_invites (hash TEXT PRIMARY KEY, team TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS quiz_sys (id INTEGER PRIMARY KEY CHECK(id=1), email TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS quiz_daily (day TEXT NOT NULL, team TEXT NOT NULL, players INTEGER NOT NULL DEFAULT 0, trainers INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,team))`,
`CREATE TABLE IF NOT EXISTS quiz_avatars (code TEXT NOT NULL, client TEXT NOT NULL, avatar INTEGER NOT NULL, PRIMARY KEY(code,client))`,
`CREATE INDEX IF NOT EXISTS quiz_history_ended ON quiz_history(ended)`
];
let quizReady=false;
async function qbody(req,max){const t=await req.text();if(t.length>max)fail('حجم الطلب أكبر من المسموح.',413);try{return t?JSON.parse(t):{}}catch{fail('بيانات الطلب غير صحيحة.')}}
async function qpass(salt,pass){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:10000},k,256);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function qissue(db,now){const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('DELETE FROM quiz_admin_tokens WHERE expires<?').bind(now).run();await db.prepare('INSERT INTO quiz_admin_tokens(hash,expires) VALUES(?,?)').bind(await hash(token),now+14*86400000).run();return token}
const QMIG=["ALTER TABLE quiz_library ADD COLUMN team TEXT NOT NULL DEFAULT 'omar'","ALTER TABLE quiz_games ADD COLUMN team TEXT NOT NULL DEFAULT 'omar'","ALTER TABLE quiz_games ADD COLUMN cls TEXT NOT NULL DEFAULT ''","ALTER TABLE quiz_history ADD COLUMN team TEXT NOT NULL DEFAULT 'omar'","ALTER TABLE quiz_history ADD COLUMN cls TEXT NOT NULL DEFAULT ''"];
async function qinit(db){await db.batch(QSCHEMA.map(s=>db.prepare(s)));for(const s of QMIG){try{await db.prepare(s).run()}catch{}}
 try{const old=await db.prepare("SELECT (SELECT count(*) FROM quiz_library WHERE team='omar')+(SELECT count(*) FROM quiz_games WHERE team='omar')+(SELECT count(*) FROM quiz_history WHERE team='omar') n,(SELECT count(*) FROM quiz_sys) s").first();if(old&&(old.n>0||old.s===0))await db.prepare("INSERT OR IGNORE INTO quiz_teams(id,name,created) VALUES('omar','Omar Nagy Training Team',?)").bind(Date.now()).run()}catch{}
 try{await db.batch([db.prepare('DELETE FROM quiz_admin'),db.prepare('DELETE FROM quiz_admin_tokens')])}catch{}}
async function qday(db,team,now,col){const day=new Date(now).toISOString().slice(0,10);const c=col==='trainers'?'trainers':'players';await db.prepare('INSERT INTO quiz_daily(day,team,'+c+') VALUES(?,?,1) ON CONFLICT(day,team) DO UPDATE SET '+c+'='+c+'+1').bind(day,team).run()}
function qemail(e){e=typeof e==='string'?e.trim().toLowerCase():'';if(!/^[^\s@]{1,64}@[^\s@]{1,100}$/.test(e))fail('اكتب إيميل صحيح.');return e}
function qlogin(e){e=typeof e==='string'?e.trim().toLowerCase():'';if(!/^[a-z0-9._-]{3,64}$/.test(e)&&!/^[^\s@]{1,64}@[^\s@]{1,100}$/.test(e))fail('اكتب يوزر (حروف وأرقام ونقطة وشرطة، 3 على الأقل) أو إيميل صحيح.');return e}
function qpw(p){if(typeof p!=='string'||p.length<6||p.length>64)fail('كلمة السر من ٦ لـ ٦٤ حرف أو رقم.');return p}
async function qsess(db,role,account,team,now){const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('DELETE FROM quiz_sessions WHERE expires<?').bind(now).run();await db.prepare('INSERT INTO quiz_sessions(hash,role,account,team,expires,seen) VALUES(?,?,?,?,?,?)').bind(await hash(token),role,account,team,now+14*86400000,now).run();return token}
async function qthrottle(db,now){const r=await db.prepare('SELECT count(*) n FROM quiz_attempts WHERE ts>?').bind(now-900000).first();if(r.n>=10)fail('محاولات كتير غلط. استنى ١٥ دقيقة وجرّب تاني.',429)}
async function qteam(req,db,now,write){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))fail('سجّل الدخول الأول.',401);
 const s=await db.prepare('SELECT hash,role,account,team,seen FROM quiz_sessions WHERE hash=? AND expires>?').bind(await hash(a.slice(7)),now).first();if(!s)fail('الجلسة انتهت. سجّل الدخول تاني.',401);
 if(s.seen<now-60000)await db.prepare('UPDATE quiz_sessions SET seen=? WHERE hash=?').bind(now,s.hash).run();
 if(s.role==='admin'){const id=req.headers.get('X-Team')||'';const t=id?await db.prepare('SELECT id FROM quiz_teams WHERE id=?').bind(id).first():null;if(!t)fail('اختار فريق الأول.',400);if(write)fail('الأدمن بيشوف بيانات الفريق للقراءة بس.',403);return {team:t.id,role:'admin',account:s.account}}
 const x=await db.prepare('SELECT a.suspended s,t.suspended ts FROM quiz_accounts a JOIN quiz_teams t ON t.id=a.team WHERE a.id=?').bind(s.account).first();if(!x||x.s||x.ts)fail('الحساب ده موقوف.',403);
 return {team:s.team,role:'user',account:s.account}}
async function qsys(req,db,now){const a=req.headers.get('Authorization')||'';const s=a.startsWith('Bearer ')?await db.prepare("SELECT 1 FROM quiz_sessions WHERE hash=? AND role='admin' AND expires>?").bind(await hash(a.slice(7)),now).first():null;if(!s)fail('ادخل بحساب الأدمن.',401)}
async function qaccount(db,now,team,email,password){const e=qlogin(email);qpw(password);const t=await db.prepare('SELECT 1 FROM quiz_teams WHERE id=?').bind(team).first();if(!t)fail('الفريق مش موجود.',404);const salt=crypto.randomUUID(),id=crypto.randomUUID();const r=await db.prepare('INSERT OR IGNORE INTO quiz_accounts(id,team,email,salt,hash,created) VALUES(?,?,?,?,?,?)').bind(id,team,e,salt,await qpass(salt,password),now).run();if(!r.meta.changes)fail('اليوزر أو الإيميل ده مستخدم بالفعل.',409);return id}
async function qreport(db,code,g,quiz,state){state=state||g.state;
  const pl=await db.prepare('SELECT client,name,team,score FROM quiz_players WHERE code=? ORDER BY score DESC,joined').bind(code).all();const an=await db.prepare('SELECT qi,client,choice,text,points,ok,ms FROM quiz_answers WHERE code=?').bind(code).all();
  const nm=new Map(pl.results.map(p=>[p.client,p.name]));
  const questions=quiz.questions.map((q,i)=>{const a=an.results.filter(x=>x.qi===i);const o={index:i,type:q.type,text:q.text,answered:a.length,players:pl.results.length};
   if(q.type==='cloud'){const w={};for(const x of a)w[x.text]=(w[x.text]||0)+1;o.words=Object.entries(w).sort((x,y)=>y[1]-x[1]).map(([word,n])=>({word,n}));return o}
   o.options=q.options;o.correct=q.correct;o.correctCount=a.filter(x=>x.ok).length;o.pct=pl.results.length?Math.round(100*o.correctCount/pl.results.length):0;o.counts=q.options.map((_,k)=>a.filter(x=>x.choice===k).length);
   o.wrong=a.filter(x=>!x.ok).map(x=>({name:nm.get(x.client)||'',choice:x.choice}));o.missing=pl.results.filter(p=>!a.some(x=>x.client===p.client)).map(p=>p.name);return o});
  const pmap=new Map(an.results.map(x=>[x.client+'|'+x.qi,x.points]));
  const players=pl.results.map((p,i)=>({rank:i+1,name:p.name,team:p.team,score:p.score,pts:quiz.questions.map((_,k)=>pmap.get(p.client+'|'+k)||0)}));
  const teamBoard=g.teams>0?Array.from({length:g.teams},(_,i)=>{const mem=players.filter(p=>p.team===i+1);return {team:i+1,members:mem.length,score:mem.length?Math.round(100*mem.reduce((s,p)=>s+p.score,0)/mem.length)/100:0}}).sort((a,b)=>b.score-a.score||a.team-b.team):null;
  return {title:quiz.title,teams:g.teams,state:state,players,teamBoard,questions}
}
async function qsave(db,code,g,quiz,now){const r=await qreport(db,code,g,quiz,'ended');const top=r.players.slice(0,3).map(p=>({name:p.name,score:p.score}));await db.prepare('INSERT OR REPLACE INTO quiz_history(code,title,ended,teams,players,top,data,team,cls) VALUES(?,?,?,?,?,?,?,?,?)').bind(code,quiz.title,now,g.teams,r.players.length,JSON.stringify(top),JSON.stringify(r),g.team||'omar',g.cls||'').run()}
function qclean(q){
 if(!q||typeof q!=='object')fail('الكويز غير صحيح.');
 const title=typeof q.title==='string'?q.title.trim():'';if(!title||title.length>80)fail('اكتب اسم للكويز لحد ٨٠ حرف.');
 if(!Array.isArray(q.questions)||q.questions.length<1||q.questions.length>50)fail('الكويز لازم يكون فيه من ١ لـ ٥٠ سؤال.');
 const questions=q.questions.map((x,i)=>{
  const type=['mc','spot','cloud'].includes(x?.type)?x.type:fail('نوع السؤال '+(i+1)+' غير صحيح.');
  const text=typeof x.text==='string'?x.text.trim():'';if(!text||text.length>300)fail('اكتب نص السؤال '+(i+1)+' لحد ٣٠٠ حرف.');
  let time=Number.isInteger(x.time)?x.time:20;if(time<5||time>240)fail('وقت السؤال '+(i+1)+' من ٥ لـ ٢٤٠ ثانية.');
  const out={type,text,time};
  if(type==='cloud'){out.points=0;return out}
  const max=type==='mc'?4:6,opts=Array.isArray(x.options)?x.options.map(o=>typeof o==='string'?o.trim():''):[];
  if(opts.length<2||opts.length>max||opts.some(o=>!o||o.length>(type==='spot'?200:120)))fail('كمّل اختيارات السؤال '+(i+1)+'.');
  if(!Number.isInteger(x.correct)||x.correct<0||x.correct>=opts.length)fail('حدد الإجابة الصح في السؤال '+(i+1)+'.');
  let points=x.points===undefined?1:x.points;if(Number.isInteger(points)&&points>100)points=1;if(!Number.isInteger(points)||points<1)fail('نقاط السؤال '+(i+1)+' من ١ لـ ١٠٠.');
  return {...out,options:opts,correct:x.correct,points}
 });
 return {title,questions}
}
function qP(q){const p=q.points;return Number.isInteger(p)&&p>=1&&p<=100?p:1}
async function qpush(db,code,now){
 const g=await db.prepare('SELECT * FROM quiz_games WHERE code=? AND expires>?').bind(code,now).first();if(!g)return null;
 const quiz=JSON.parse(g.quiz),total=quiz.questions.length,cur=g.state==='question'?quiz.questions[g.qi]:null,answering=!!cur&&now<g.q_end;
 const pub={code,title:quiz.title,teams:g.teams,state:g.state,qi:g.qi,total,serverNow:now,qStart:g.q_start,qEnd:g.q_end,isHost:false};
 pub.phase=g.state==='lobby'?'lobby':g.state==='ended'?'ended':answering?'answering':'reveal';
 if(cur)pub.q=qpublicQ(cur,!answering);
 const pl=await db.prepare('SELECT client,name,team,score,joined,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? ORDER BY score DESC,joined').bind(code).all();
 const rows=pl.results;const avf=p=>p.av===null||p.av===undefined?-1:p.av;
 const ans=cur?(await db.prepare('SELECT client,choice,text,points,ok FROM quiz_answers WHERE code=? AND qi=?').bind(code,g.qi).all()).results:[];
 pub.playerCount=rows.length;
 if(g.state==='lobby')pub.players=[...rows].sort((a,b)=>b.joined-a.joined).slice(0,60).map(p=>({name:p.name,team:p.team,av:p.av}));
 let prev=null,rank=0;const ranked=rows.map((p,i)=>{if(p.score!==prev)rank=i+1;prev=p.score;return {...p,rank}});
 const reveal=g.state==='question'&&!answering||g.state==='ended';let tb=null;
 if(reveal){
  pub.leaderboard=ranked.slice(0,g.state==='ended'?10:5).map(p=>({rank:p.rank,name:p.name,team:p.team,score:p.score,av:avf(p)}));
  if(g.teams>0){tb=Array.from({length:g.teams},(_,i)=>{const mem=ranked.filter(p=>p.team===i+1);return {team:i+1,members:mem.length,score:mem.length?Math.round(100*mem.reduce((s,p)=>s+p.score,0)/mem.length)/100:0}}).sort((a,b)=>b.score-a.score||a.team-b.team);pub.teamBoard=tb}
  if(cur){pub.answered=ans.length;if(cur.type==='cloud'){const w={};for(const x of ans)w[x.text]=(w[x.text]||0)+1;pub.words=Object.entries(w).sort((x,y)=>y[1]-x[1]).slice(0,60).map(([word,n])=>({word,n}))}else pub.counts=cur.options.map((_,k)=>ans.filter(x=>x.choice===k).length)}}
 const am=new Map(ans.map(a=>[a.client,a]));const me={};
 for(const p of ranked){const o={name:p.name,team:p.team,score:p.score,av:avf(p)};
  if(cur){const a=am.get(p.client);o.answered=!!a;if(a&&!answering){o.ok=!!a.ok;o.points=a.points}if(a&&answering&&cur.type==='cloud')o.text=a.text;if(a&&cur.type!=='cloud')o.choice=a.choice}
  if(reveal){o.rank=p.rank;if(tb)o.teamRank=tb.findIndex(x=>x.team===p.team)+1}
  me[p.client]=o}
 return {pub,me,g,answering}}
function qpublicQ(q,withCorrect){const o={type:q.type,text:q.text,time:q.time,points:qP(q)};if(q.options)o.options=q.options;if(withCorrect&&q.correct!==undefined)o.correct=q.correct;return o}
async function qhandle(req,env,path,u,now){
 const db=env.DB;
 if(!quizReady){await qinit(db);quizReady=true}
 const m=req.method,sub=path.slice('/api/quiz'.length);
 // ---- accounts / admin ----
 if(sub==='/admin/status'&&m==='GET'){const r=await db.prepare('SELECT 1 FROM quiz_sys WHERE id=1').first();return json({configured:true,teams:true,sysConfigured:!!r})}
 if(sub==='/login'&&m==='POST'){await qthrottle(db,now);const b=await qbody(req,2048);const e=typeof b.email==='string'?b.email.trim().toLowerCase():'';const a=e?await db.prepare('SELECT a.id,a.team,a.salt,a.hash,a.suspended s,t.name,t.suspended ts FROM quiz_accounts a JOIN quiz_teams t ON t.id=a.team WHERE a.email=?').bind(e).first():null;
  const ok=a&&await qpass(a.salt,typeof b.password==='string'?b.password:'')===a.hash;if(!ok){await db.prepare('INSERT INTO quiz_attempts(ts) VALUES(?)').bind(now).run();fail('الإيميل أو كلمة السر غلط.',403)}
  if(a.s||a.ts)fail('الحساب ده موقوف.',403);await qday(db,a.team,now,'trainers');return json({token:await qsess(db,'user',a.id,a.team,now),email:e,team:{id:a.team,name:a.name}})}
 if(sub==='/me'&&m==='GET'){const T=await qteam(req,db,now,false);const t=await db.prepare('SELECT id,name FROM quiz_teams WHERE id=?').bind(T.team).first();return json({team:t,role:T.role})}
 if(sub==='/invite/info'&&m==='GET'){const i=await db.prepare('SELECT i.team,t.name FROM quiz_invites i JOIN quiz_teams t ON t.id=i.team WHERE i.hash=? AND i.used=0 AND i.expires>?').bind(await hash(u.searchParams.get('t')||'x'),now).first();if(!i)fail('اللينك ده انتهى أو اتستخدم.',404);return json({team:i.name})}
 if(sub==='/invite/accept'&&m==='POST'){const b=await qbody(req,2048);const h=await hash(String(b.token||'x'));const i=await db.prepare('SELECT team FROM quiz_invites WHERE hash=? AND used=0 AND expires>?').bind(h,now).first();if(!i)fail('اللينك ده انتهى أو اتستخدم.',404);
  const id=await qaccount(db,now,i.team,b.email,b.password);await db.prepare('UPDATE quiz_invites SET used=1 WHERE hash=?').bind(h).run();const t=await db.prepare('SELECT name FROM quiz_teams WHERE id=?').bind(i.team).first();await qday(db,i.team,now,'trainers');return json({token:await qsess(db,'user',id,i.team,now),email:qlogin(b.email),team:{id:i.team,name:t.name}},201)}
 if(sub==='/sys/setup'&&m==='POST'){const b=await qbody(req,2048);const e=qlogin(b.email);qpw(b.password);const salt=crypto.randomUUID();const r=await db.prepare('INSERT OR IGNORE INTO quiz_sys(id,email,salt,hash) VALUES(1,?,?,?)').bind(e,salt,await qpass(salt,b.password)).run();if(!r.meta.changes)fail('حساب الأدمن متحدد بالفعل.',409);return json({token:await qsess(db,'admin','sys','',now)},201)}
 if(sub==='/sys/login'&&m==='POST'){await qthrottle(db,now);const b=await qbody(req,2048);const row=await db.prepare('SELECT email,salt,hash FROM quiz_sys WHERE id=1').first();
  if(!row||row.email!==String(b.email||'').trim().toLowerCase()||await qpass(row.salt,typeof b.password==='string'?b.password:'')!==row.hash){await db.prepare('INSERT INTO quiz_attempts(ts) VALUES(?)').bind(now).run();fail('الإيميل أو كلمة السر غلط.',403)}
  return json({token:await qsess(db,'admin','sys','',now)})}
 if(sub.startsWith('/sys/')){await qsys(req,db,now);
  if(sub==='/sys/teams'&&m==='GET'){const r=await db.prepare('SELECT t.id,t.name,t.suspended,t.created,(SELECT count(*) FROM quiz_accounts a WHERE a.team=t.id) members,(SELECT a.email FROM quiz_accounts a WHERE a.team=t.id ORDER BY a.created LIMIT 1) login,(SELECT count(*) FROM quiz_library l WHERE l.team=t.id) quizzes,(SELECT count(*) FROM quiz_history h WHERE h.team=t.id) games FROM quiz_teams t ORDER BY t.created').all();return json({teams:r.results})}
  if(sub==='/sys/teams/create'&&m==='POST'){const b=await qbody(req,2048);const n=typeof b.name==='string'?b.name.trim():'';if(!n||n.length>60)fail('اسم الفريق لحد ٦٠ حرف.');const id=crypto.randomUUID().slice(0,12);if(b.email!==undefined&&b.email!==''){const e=qlogin(b.email);qpw(b.password);if(await db.prepare('SELECT 1 FROM quiz_accounts WHERE email=?').bind(e).first())fail('اليوزر أو الإيميل ده مستخدم بالفعل.',409);const salt=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO quiz_teams(id,name,created) VALUES(?,?,?)').bind(id,n,now),db.prepare('INSERT INTO quiz_accounts(id,team,email,salt,hash,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,e,salt,await qpass(salt,b.password),now)]);return json({id,login:e},201)}await db.prepare('INSERT INTO quiz_teams(id,name,created) VALUES(?,?,?)').bind(id,n,now).run();return json({id},201)}
  if(sub==='/sys/teams/rename'&&m==='POST'){const b=await qbody(req,2048);const n=typeof b.name==='string'?b.name.trim():'';if(!n||n.length>60)fail('اسم الفريق لحد ٦٠ حرف.');const r=await db.prepare('UPDATE quiz_teams SET name=? WHERE id=?').bind(n,String(b.id||'')).run();if(!r.meta.changes)fail('الفريق مش موجود.',404);return json({ok:true})}
  if(sub==='/sys/teams/invite'&&m==='POST'){const b=await qbody(req,2048);const t=await db.prepare('SELECT 1 FROM quiz_teams WHERE id=?').bind(String(b.id||'')).first();if(!t)fail('الفريق مش موجود.',404);const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('DELETE FROM quiz_invites WHERE expires<?').bind(now).run();await db.prepare('INSERT INTO quiz_invites(hash,team,expires) VALUES(?,?,?)').bind(await hash(token),b.id,now+86400000).run();return json({token,expires:now+86400000},201)}
  if(sub==='/sys/teams/suspend'&&m==='POST'){const b=await qbody(req,2048);await db.prepare('UPDATE quiz_teams SET suspended=? WHERE id=?').bind(b.suspended?1:0,String(b.id||'')).run();return json({ok:true})}
  if(sub==='/sys/accounts'&&m==='GET'){const r=await db.prepare('SELECT id,email,suspended,created FROM quiz_accounts WHERE team=? ORDER BY created').bind(u.searchParams.get('team')||'').all();return json({accounts:r.results})}
  if(sub==='/sys/accounts/create'&&m==='POST'){const b=await qbody(req,2048);const id=await qaccount(db,now,String(b.team||''),b.email,b.password);return json({id},201)}
  if(sub==='/sys/accounts/reset'&&m==='POST'){const b=await qbody(req,2048);qpw(b.password);const salt=crypto.randomUUID();const r=await db.prepare('UPDATE quiz_accounts SET salt=?,hash=? WHERE id=?').bind(salt,await qpass(salt,b.password),String(b.id||'')).run();if(!r.meta.changes)fail('الحساب مش موجود.',404);await db.prepare('DELETE FROM quiz_sessions WHERE account=?').bind(b.id).run();return json({ok:true})}
  if(sub==='/sys/accounts/update'&&m==='POST'){const b=await qbody(req,2048);const e=qlogin(b.email);let r;try{r=await db.prepare('UPDATE quiz_accounts SET email=? WHERE id=?').bind(e,String(b.id||'')).run()}catch{fail('اليوزر أو الإيميل ده مستخدم بالفعل.',409)}if(!r.meta.changes)fail('الحساب مش موجود.',404);return json({ok:true,email:e})}
  if(sub==='/sys/accounts/delete'&&m==='POST'){const b=await qbody(req,2048);const id=String(b.id||'');await db.prepare('DELETE FROM quiz_sessions WHERE account=?').bind(id).run();const r=await db.prepare('DELETE FROM quiz_accounts WHERE id=?').bind(id).run();if(!r.meta.changes)fail('الحساب مش موجود.',404);return json({ok:true})}
  if(sub==='/sys/teams/delete'&&m==='POST'){const b=await qbody(req,2048);const id=String(b.id||'');const t=await db.prepare('SELECT name FROM quiz_teams WHERE id=?').bind(id).first();if(!t)fail('الفريق مش موجود.',404);if(String(b.name||'').trim()!==t.name)fail('اكتب اسم الفريق بالظبط للتأكيد.');const C='SELECT code FROM quiz_games WHERE team=?';await db.batch([db.prepare('DELETE FROM quiz_answers WHERE code IN ('+C+')').bind(id),db.prepare('DELETE FROM quiz_players WHERE code IN ('+C+')').bind(id),db.prepare('DELETE FROM quiz_avatars WHERE code IN ('+C+')').bind(id),db.prepare('DELETE FROM quiz_history WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_games WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_library WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_invites WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_sessions WHERE team=? AND role=?').bind(id,'user'),db.prepare('DELETE FROM quiz_accounts WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_daily WHERE team=?').bind(id),db.prepare('DELETE FROM quiz_teams WHERE id=?').bind(id)]);return json({ok:true})}
  if(sub==='/sys/accounts/suspend'&&m==='POST'){const b=await qbody(req,2048);await db.prepare('UPDATE quiz_accounts SET suspended=? WHERE id=?').bind(b.suspended?1:0,String(b.id||'')).run();if(b.suspended)await db.prepare('DELETE FROM quiz_sessions WHERE account=?').bind(b.id).run();return json({ok:true})}
  if(sub==='/sys/stats'&&m==='GET'){const pl=await db.prepare("SELECT g.team,count(*) n FROM quiz_players p JOIN quiz_games g ON g.code=p.code WHERE g.state!='ended' AND g.expires>? AND p.joined>? GROUP BY g.team").bind(now,now-10800000).all();
   const tr=await db.prepare("SELECT team,count(*) n FROM quiz_sessions WHERE role='user' AND seen>? GROUP BY team").bind(now-300000).all();
   const tm=await db.prepare('SELECT id,name FROM quiz_teams ORDER BY created').all();const day=new Date(now-13*86400000).toISOString().slice(0,10);
   const dl=await db.prepare('SELECT day,sum(players) players,sum(trainers) trainers FROM quiz_daily WHERE day>=? GROUP BY day ORDER BY day').bind(day).all();
   const teams=tm.results.map(t=>({id:t.id,name:t.name,players:pl.results.find(x=>x.team===t.id)?.n||0,trainers:tr.results.find(x=>x.team===t.id)?.n||0}));
   return json({teams,players:teams.reduce((s,t)=>s+t.players,0),trainers:teams.reduce((s,t)=>s+t.trainers,0),daily:dl.results})}
  fail('الطلب غير مسموح.',405)}
 // ---- library (admin) ----
 if(sub==='/library'&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT id,title,data,updated FROM quiz_library WHERE team=? ORDER BY updated DESC').bind(T.team).all();return json({quizzes:r.results.map(x=>{const d=JSON.parse(x.data);return {id:x.id,title:x.title,count:d.questions.length,types:[...new Set(d.questions.map(q=>q.type))],updated:x.updated}})})}
 let lm=sub.match(/^\/library\/([A-Za-z0-9-]{8,40})$/);
 if(lm&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT id,data FROM quiz_library WHERE id=? AND team=?').bind(lm[1],T.team).first();if(!r)fail('الكويز مش موجود.',404);return json({id:r.id,quiz:JSON.parse(r.data)})}
 if(sub==='/library/save'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,70000);const quiz=qclean(b.quiz);let id=typeof b.id==='string'&&/^[A-Za-z0-9-]{8,40}$/.test(b.id)?b.id:null;
  if(id){const e=await db.prepare('SELECT 1 FROM quiz_library WHERE id=? AND team=?').bind(id,T.team).first();if(!e)id=null}
  if(!id){const n=await db.prepare('SELECT count(*) n FROM quiz_library WHERE team=?').bind(T.team).first();if(n.n>=100)fail('وصلت للحد الأقصى ١٠٠ كويز. امسح كويز قديم.',429);id=crypto.randomUUID()}
  await db.prepare('INSERT INTO quiz_library(id,title,data,updated,team) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data=excluded.data,updated=excluded.updated WHERE quiz_library.team=excluded.team').bind(id,quiz.title,JSON.stringify(quiz),now,T.team).run();return json({id})}
 if(sub==='/library/delete'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,2048);if(typeof b.id!=='string')fail('الكويز غير صحيح.');await db.prepare('DELETE FROM quiz_library WHERE id=? AND team=?').bind(b.id,T.team).run();return json({ok:true})}
 // ---- games ----
 if(sub==='/history'&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT code,title,ended,teams,players,top,cls FROM quiz_history WHERE team=? ORDER BY ended DESC LIMIT 500').bind(T.team).all();const n=await db.prepare('SELECT count(*) n FROM quiz_history WHERE team=?').bind(T.team).first();return json({games:r.results.map(x=>({...x,top:JSON.parse(x.top)})),total:n.n})}
 if(sub.startsWith('/history/')&&sub!=='/history/delete'&&m==='GET'){const T=await qteam(req,db,now,m!=='GET');const r=await db.prepare('SELECT data,ended,cls FROM quiz_history WHERE code=? AND team=?').bind(sub.slice(9),T.team).first();if(!r)fail('اللعبة مش موجودة في السجل.',404);return json({report:JSON.parse(r.data),ended:r.ended})}
 if(sub==='/history/delete'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,2048);if(typeof b.code!=='string')fail('الكود غير صحيح.');await db.prepare('DELETE FROM quiz_history WHERE code=? AND team=?').bind(b.code,T.team).run();return json({ok:true})}
 if(sub==='/game/create'&&m==='POST'){const T=await qteam(req,db,now,m!=='GET');const b=await qbody(req,2048);const r=await db.prepare('SELECT data FROM quiz_library WHERE id=? AND team=?').bind(String(b.quizId||''),T.team).first();if(!r)fail('الكويز مش موجود.',404);
  const cls=typeof b.cls==='string'?b.cls.trim().replace(/\s+/g,' '):'';if(!cls||cls.length>60)fail('اكتب اسم الفصل أو المجموعة (لحد ٦٠ حرف).');const teams=b.teams===undefined||b.teams===0?0:b.teams;if(!Number.isInteger(teams)||teams<0||teams===1||teams>6)fail('عدد الفرق من ٢ لـ ٦.');
  await db.batch(['DELETE FROM quiz_avatars WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_answers WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_players WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_games WHERE expires<?'].map(s=>db.prepare(s).bind(now)));
  const token=crypto.randomUUID()+crypto.randomUUID(),th=await hash(token);let code,ok=false;
  for(let i=0;i<8&&!ok;i++){code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);const used=await db.prepare('SELECT 1 FROM sessions WHERE code=?').bind(code).first().catch(()=>null);if(used)continue;const x=await db.prepare("INSERT OR IGNORE INTO quiz_games(code,token,quiz,teams,state,qi,q_start,q_end,expires,team,cls) VALUES(?,?,?,?,'lobby',0,0,0,?,?,?)").bind(code,th,r.data,teams,now+3*86400000,T.team,cls).run();ok=!!x.meta.changes}
  if(!ok)fail('تعذّر إنشاء كود جديد. جرّب تاني.',503);return json({code,token},201)}
 const gm=sub.match(/^\/game\/(\d{6})(?:\/(state|join|answer|host|report))?$/);if(!gm)fail('الرابط مش موجود.',404);
 const code=gm[1],action=gm[2]||'state';
 const g=await db.prepare('SELECT * FROM quiz_games WHERE code=? AND expires>?').bind(code,now).first();if(!g)fail('الكود غير صحيح أو الكويز انتهى.',404);
 const quiz=JSON.parse(g.quiz),total=quiz.questions.length;
 const auth=req.headers.get('Authorization')||'';const isHost=auth.startsWith('Bearer ')&&await hash(auth.slice(7))===g.token;
 const client=async c=>{if(typeof c!=='string'||!c||c.length>100)fail('بيانات المتصفح غير صحيحة.');return hash(c)};
 if(action==='join'&&m==='POST'){const b=await qbody(req,2048);const c=await client(b.client);const name=typeof b.name==='string'?b.name.trim():'';if(!name||name.length>40)fail('اكتب اسمك لحد ٤٠ حرف.');
  const ex=await db.prepare('SELECT name,team FROM quiz_players WHERE code=? AND client=?').bind(code,c).first();if(ex)return json({ok:true,name:ex.name,team:ex.team});
  if(g.state==='ended')fail('الكويز خلص.',409);const cnt=await db.prepare('SELECT count(*) n FROM quiz_players WHERE code=?').bind(code).first();if(cnt.n>=200)fail('وصلنا للحد الأقصى ٢٠٠ مشارك.',429);
  let team=0;if(g.teams>0){const t=await db.prepare('SELECT team,count(*) n FROM quiz_players WHERE code=? GROUP BY team').bind(code).all();const sizes=Array.from({length:g.teams},(_,i)=>t.results.find(x=>x.team===i+1)?.n||0);team=sizes.indexOf(Math.min(...sizes))+1}
  const ins=await db.prepare('INSERT OR IGNORE INTO quiz_players(code,client,name,team,joined) VALUES(?,?,?,?,?)').bind(code,c,name,team,now).run();if(ins.meta.changes)await qday(db,g.team,now,'players');const av=Number.isInteger(b.avatar)&&b.avatar>=0&&b.avatar<8?b.avatar:-1;if(av>=0)await db.prepare('INSERT OR IGNORE INTO quiz_avatars(code,client,avatar) VALUES(?,?,?)').bind(code,c,av).run();return json({ok:true,name,team},201)}
 if(action==='answer'&&m==='POST'){const b=await qbody(req,2048);const c=await client(b.client);
  if(g.state!=='question'||b.qi!==g.qi)fail('السؤال ده مش مفتوح.',409);if(now>g.q_end+1500)fail('الوقت خلص.',409);
  const p=await db.prepare('SELECT 1 FROM quiz_players WHERE code=? AND client=?').bind(code,c).first();if(!p)fail('ادخل بالاسم الأول.',403);
  const q=quiz.questions[g.qi];let choice=null,text=null,ok=0,points=0;const ms=Math.max(0,now-g.q_start);
  if(q.type==='cloud'){let w=typeof b.text==='string'?b.text.trim().replace(/\s+/g,' ').toLowerCase():'';if(!w||w.length>30)fail('اكتب كلمة أو جملة قصيرة لحد ٣٠ حرف.');text=w}
  else{if(!Number.isInteger(b.choice)||b.choice<0||b.choice>=q.options.length)fail('اختيار غير صحيح.');choice=b.choice;ok=choice===q.correct?1:0;if(ok)points=Math.round(qP(q)*(1+0.5*(1-Math.min(1,ms/(q.time*1000))))*100)/100}
  const r=await db.prepare('INSERT OR IGNORE INTO quiz_answers(code,qi,client,choice,text,ms,points,ok) VALUES(?,?,?,?,?,?,?,?)').bind(code,g.qi,c,choice,text,ms,points,ok).run();
  if(!r.meta.changes)return json({ok:true,duplicate:true});
  if(points)await db.prepare('UPDATE quiz_players SET score=ROUND(score+?,2) WHERE code=? AND client=?').bind(points,code,c).run();
  const n=await db.prepare('SELECT (SELECT count(*) FROM quiz_answers WHERE code=? AND qi=?) a,(SELECT count(*) FROM quiz_players WHERE code=?) p').bind(code,g.qi,code).first();
  if(n.a>=n.p)await db.prepare("UPDATE quiz_games SET q_end=? WHERE code=? AND qi=? AND state='question' AND q_end>?").bind(now,code,g.qi,now).run();
  return json({ok:true},201)}
 if(action==='host'&&m==='POST'){if(!isHost)fail('شاشة المدرب دي مش متاحة من المتصفح الحالي.',403);const b=await qbody(req,2048);
  if(b.action==='start'){if(g.state!=='lobby')fail('الكويز بدأ بالفعل.',409);const n=await db.prepare('SELECT count(*) n FROM quiz_players WHERE code=?').bind(code).first();if(!n.n)fail('مفيش مشاركين لسه.',409);const q=quiz.questions[0];await db.prepare("UPDATE quiz_games SET state='question',qi=0,q_start=?,q_end=? WHERE code=?").bind(now,now+q.time*1000,code).run();return json({ok:true})}
  if(b.action==='reveal'){if(g.state!=='question')fail('مفيش سؤال مفتوح.',409);await db.prepare('UPDATE quiz_games SET q_end=? WHERE code=? AND q_end>?').bind(now,code,now).run();return json({ok:true})}
  if(b.action==='next'){if(g.state!=='question')fail('مفيش سؤال مفتوح.',409);if(b.qi!==g.qi)return json({ok:true,duplicate:true});if(g.qi+1>=total){await db.prepare("UPDATE quiz_games SET state='ended' WHERE code=?").bind(code).run();await qsave(db,code,g,quiz,now);return json({ok:true,ended:true})}const q=quiz.questions[g.qi+1];await db.prepare("UPDATE quiz_games SET qi=qi+1,q_start=?,q_end=? WHERE code=? AND qi=?").bind(now,now+q.time*1000,code,g.qi).run();return json({ok:true})}
  if(b.action==='end'){await db.prepare("UPDATE quiz_games SET state='ended' WHERE code=?").bind(code).run();await qsave(db,code,g,quiz,now);return json({ok:true})}
  fail('أمر غير صحيح.')}
 if(action==='report'&&m==='GET'){if(!isHost)fail('شاشة المدرب دي مش متاحة من المتصفح الحالي.',403);
  return json(await qreport(db,code,g,quiz))}
 // ---- state (players and host) ----
 if(action==='state'&&m==='GET'){
  const cl=u.searchParams.get('client')||'';const c=cl&&cl.length<100?await hash(cl):'';
  const out={code,title:quiz.title,teams:g.teams,state:g.state,qi:g.qi,total,serverNow:now,qStart:g.q_start,qEnd:g.q_end,isHost};
  const me=c?await db.prepare('SELECT name,team,score,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? AND client=?').bind(code,c).first():null;
  const cur=g.state==='question'?quiz.questions[g.qi]:null;const answering=!!cur&&now<g.q_end;out.phase=g.state==='lobby'?'lobby':g.state==='ended'?'ended':answering?'answering':'reveal';
  if(cur)out.q=qpublicQ(cur,isHost||!answering);
  if(me){out.me={name:me.name,team:me.team,score:me.score,av:me.av===null||me.av===undefined?-1:me.av};if(cur){const a=await db.prepare('SELECT choice,text,points,ok FROM quiz_answers WHERE code=? AND qi=? AND client=?').bind(code,g.qi,c).first();out.me.answered=!!a;if(a&&!answering){out.me.ok=!!a.ok;out.me.points=a.points}if(a&&answering&&cur.type==='cloud')out.me.text=a.text;if(a&&cur.type!=='cloud')out.me.choice=a.choice}}
  if(isHost||g.state==='lobby'){const cnt=await db.prepare('SELECT count(*) n FROM quiz_players WHERE code=?').bind(code).first();out.playerCount=cnt.n;if(g.state==='lobby'){const l=await db.prepare('SELECT name,team,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? ORDER BY joined DESC LIMIT 60').bind(code).all();out.players=l.results}}
  if(isHost&&answering){const a=await db.prepare('SELECT count(*) n FROM quiz_answers WHERE code=? AND qi=?').bind(code,g.qi).first();out.answered=a.n}
  if(g.state==='question'&&!answering||g.state==='ended'){
   const lb=await db.prepare('SELECT client,name,team,score,(SELECT avatar FROM quiz_avatars a WHERE a.code=quiz_players.code AND a.client=quiz_players.client) av FROM quiz_players WHERE code=? ORDER BY score DESC,joined').bind(code).all();let prev=null,rank=0;const rows=lb.results.map((p,i)=>{if(p.score!==prev)rank=i+1;prev=p.score;return {...p,rank}});
   out.leaderboard=rows.slice(0,g.state==='ended'?10:5).map(p=>({rank:p.rank,name:p.name,team:p.team,score:p.score,av:p.av===null||p.av===undefined?-1:p.av}));out.playerCount=rows.length;const mine=rows.find(p=>p.client===c);if(mine&&out.me)out.me.rank=mine.rank;
   if(g.teams>0){const tb=Array.from({length:g.teams},(_,i)=>{const mem=rows.filter(p=>p.team===i+1);return {team:i+1,members:mem.length,score:mem.length?Math.round(100*mem.reduce((s,p)=>s+p.score,0)/mem.length)/100:0}}).sort((a,b)=>b.score-a.score||a.team-b.team);out.teamBoard=tb;if(out.me)out.me.teamRank=tb.findIndex(x=>x.team===out.me.team)+1}
   if(cur){const a=await db.prepare('SELECT choice,text FROM quiz_answers WHERE code=? AND qi=?').bind(code,g.qi).all();out.answered=a.results.length;if(cur.type==='cloud'){const w={};for(const x of a.results)w[x.text]=(w[x.text]||0)+1;out.words=Object.entries(w).sort((x,y)=>y[1]-x[1]).slice(0,60).map(([word,n])=>({word,n}))}else out.counts=cur.options.map((_,k)=>a.results.filter(x=>x.choice===k).length)}}
  return json(out)}
 fail('الطلب غير مسموح.',405)}

const app = {
async fetch(req,env){try{
const u=new URL(req.url),path=u.pathname,now=Date.now();
if(path==='/qr'&&req.method==='GET'){const code=u.searchParams.get('code');if(!/^\d{6}$/.test(code||''))return json({error:'كود غير صحيح.'},400);const qr=qrcode(0,'M');qr.addData((u.searchParams.get('frontend')==='pages'?'https://omarnagycd.github.io/RoomPulse/join/':u.origin+'/join')+'?code='+code+'&lang='+(u.searchParams.get('lang')==='en'?'en':'ar'));qr.make();return new Response(qr.createSvgTag({cellSize:5,margin:20,scalable:true}),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public,max-age=300'}})}
if(!path.startsWith('/api/')){if(path!=='/'&&path!=='/join')return new Response('Not found',{status:404});return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"}})}
if(!env.DB)fail('الخدمة قيد التجهيز. جرّب بعد قليل.',503);
const wm=path.match(/^\/api\/quiz\/game\/(\d{6})\/ws$/);
if(wm){if(!env.ROOM)fail('الخدمة قيد التجهيز.',503);const cl=u.searchParams.get('client')||'';if(!cl||cl.length>100)fail('بيانات المتصفح غير صحيحة.');const gx=await env.DB.prepare('SELECT 1 FROM quiz_games WHERE code=? AND expires>?').bind(wm[1],now).first();if(!gx)fail('الكود غير صحيح أو الكويز انتهى.',404);return await env.ROOM.get(env.ROOM.idFromName(wm[1])).fetch(new Request('https://room/ws?code='+wm[1]+'&c='+encodeURIComponent(cl),req))}
if(path.startsWith('/api/quiz/')){const qres=await qhandle(req,env,path,u,now);const nm=path.match(/^\/api\/quiz\/game\/(\d{6})\/(join|host|answer)$/);if(nm&&req.method==='POST'&&qres.ok)await qnotify(env,nm[1]);return qres}
if(req.method==='POST'&&path==='/api/sessions'){
const b=await body(req),title=clean(b.title,80),question=clean(b.question,300),mode=['text','ranking'].includes(b.mode)?b.mode:'poll',identity=b.identity==='named'?'named':'anonymous';
if(mode!=='text'&&(!Array.isArray(b.options)||![2,3].includes(b.options.length)))fail('مطلوب خيارين أو ٣ اختيارات.');const options=mode==='text'?[]:b.options.map(x=>clean(x,200));
let groupCode=null;if(mode==='ranking'&&b.rankingRound){const prior=b.rankingRound;if(typeof prior.code!=='string'||typeof prior.token!=='string'||prior.token.length>200)fail('جولة غير صحيحة.',403);const owner=await env.DB.prepare('SELECT s.token,r.group_code,g.ended,i.identity FROM sessions s JOIN ranking_sessions r ON r.code=s.code JOIN ranking_rounds g ON g.code=r.group_code JOIN session_identity i ON i.code=s.code WHERE s.code=? AND s.expires>?').bind(prior.code,now).first();if(!owner||owner.token!==await hash(prior.token))fail('الجولة دي مش متاحة من المتصفح الحالي.',403);if(owner.ended)fail('الجولة انتهت. ابدأ جولة جديدة.',409);if(owner.identity!==identity)fail('خلي وضع الأسماء ثابت في نفس الجولة.');groupCode=owner.group_code;const size=await env.DB.prepare('SELECT count(*) as n FROM ranking_sessions WHERE group_code=?').bind(groupCode).first();if(size.n>=50)fail('الجولة وصلت ٥٠ سؤال. ابدأ جولة جديدة.',409);}
const correct=mode==='ranking'&&b.hasCorrect===true?b.correctChoice:null;if(correct!==null&&(!Number.isInteger(correct)||correct<0||correct>=options.length))fail('اختار الإجابة الصحيحة من الاختيارات.');
const duration=b.durationSeconds??0;if(!Number.isInteger(duration)||duration<0||duration>86399)fail('اختار مدة صحيحة من ثانية لحد ٢٣ ساعة و٥٩ دقيقة و٥٩ ثانية، أو اقفل المؤقت.');
await env.DB.batch(schema.map(s=>env.DB.prepare(s)));
await env.DB.batch([env.DB.prepare('DELETE FROM ranking_rounds WHERE code NOT IN (SELECT group_code FROM ranking_sessions WHERE code IN (SELECT code FROM sessions WHERE expires >= ?))').bind(now),env.DB.prepare('DELETE FROM ranking_answers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM ranking_sessions WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_timers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM participant_names WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_identity WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM text_answers WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM session_modes WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM votes WHERE code IN (SELECT code FROM sessions WHERE expires < ?)').bind(now),env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now)]);
const count=await env.DB.prepare('SELECT count(*) as n FROM sessions').first();if(count.n>=1000)fail('وصلنا للحد التجريبي اليومي. جرّب لاحقاً.',429);
if(groupCode)await env.DB.prepare('UPDATE sessions SET open=0 WHERE code IN (SELECT code FROM ranking_sessions WHERE group_code=?)').bind(groupCode).run();
const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await hash(token);let code,ok=false;
for(let i=0;i<5;i++){code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);const r=await env.DB.prepare('INSERT OR IGNORE INTO sessions(code,token,title,question,options,expires) VALUES(?,?,?,?,?,?)').bind(code,tokenHash,title,question,JSON.stringify(options),now+86400000).run();if(r.meta.changes){ok=true;break}}
if(!ok)fail('تعذّر إنشاء كود جديد. جرّب تاني.',503);await env.DB.prepare('INSERT INTO session_modes(code,mode) VALUES(?,?)').bind(code,mode).run();await env.DB.prepare('INSERT INTO session_identity(code,identity) VALUES(?,?)').bind(code,identity).run();if(mode==='ranking'){groupCode=groupCode||code;await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO ranking_rounds(code) VALUES(?)').bind(groupCode),env.DB.prepare('INSERT INTO ranking_sessions(code,started,correct,group_code) VALUES(?,?,?,?)').bind(code,now,correct,groupCode)]);}if(duration)await env.DB.prepare('INSERT INTO session_timers(code,duration,ends_at) VALUES(?,?,?)').bind(code,duration,Date.now()+duration*1000).run();return json({code,token},201)}
const m=path.match(/^\/api\/sessions\/(\d{6})(?:\/(results|vote|status|finish))?$/);if(!m)fail('الرابط مش موجود.',404);const code=m[1],action=m[2];
let s;try{s=await env.DB.prepare('SELECT * FROM sessions WHERE code=? AND expires>?').bind(code,now).first()}catch{fail('مفيش سيشن بالكود ده. اتأكد من الكود.',404)}
if(!s)fail('الكود غير صحيح أو السيشن انتهى. اتأكد من المدرب.',404);
const row=await env.DB.prepare('SELECT mode FROM session_modes WHERE code=?').bind(code).first();const mode=row?.mode||'poll';const ident=await env.DB.prepare('SELECT identity FROM session_identity WHERE code=?').bind(code).first();const identity=ident?.identity||'anonymous';let clock=null;try{clock=await env.DB.prepare('SELECT duration,ends_at FROM session_timers WHERE code=?').bind(code).first()}catch(e){if(!String(e.message).includes('no such table'))throw e}const timeUp=!!clock&&now>=clock.ends_at;if(timeUp)s.open=0;const options=JSON.parse(s.options),base={code,mode,identity,title:s.title,question:s.question,options,open:!!s.open,expires:s.expires,durationSeconds:clock?.duration||0,endsAt:clock?.ends_at||null,serverNow:now,timeUp};
const ranking=mode==='ranking'?await env.DB.prepare('SELECT r.started,r.correct,r.group_code,g.ended FROM ranking_sessions r JOIN ranking_rounds g ON g.code=r.group_code WHERE r.code=?').bind(code).first():null;if(ranking){base.hasCorrect=ranking.correct!==null;if(ranking.ended){s.open=0;base.open=false;}base.roundEnded=!!ranking.ended;}
if(!action&&req.method==='GET'){const c=u.searchParams.get('client')||'';let voted=false;if(c&&c.length<100){const v=await env.DB.prepare(mode==='ranking'?'SELECT 1 FROM ranking_answers WHERE code=? AND client=?':mode==='text'?'SELECT 1 FROM text_answers WHERE code=? AND client=?':'SELECT 1 FROM votes WHERE code=? AND client=?').bind(code,await hash(c)).first();voted=!!v}return json({...base,voted})}
if(action==='vote'&&req.method==='POST'){
if(timeUp)fail('الوقت خلص. استقبال الردود اتقفل تلقائياً.',409);const b=await body(req);if(identity==='named'){if(typeof b.client!=='string'||!b.client||b.client.length>100)fail('بيانات المتصفح غير صحيحة.');if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200)fail('اكتب الاسم اللي تحب تظهر بيه، لحد ٢٠٠ حرف.');const name=b.name;if(!s.open)fail('المدرب قفل استقبال الردود.',409);await env.DB.prepare('INSERT OR IGNORE INTO participant_names(code,client,name) VALUES(?,?,?)').bind(code,await hash(b.client),name).run()}if(mode==='text'){if(typeof b.client!=='string'||!b.client||b.client.length>100)fail('بيانات المتصفح غير صحيحة.');const answer=clean(b.answer,500),c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM text_answers WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل الردود.',409);const r=await env.DB.prepare('INSERT OR IGNORE INTO text_answers(code,client,answer,created) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday(\'now\')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM text_answers WHERE code=?)<5000').bind(code,c,answer,now,code,now,code,code).run();if(!r.meta.changes)fail('استقبال الردود مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}if(typeof b.client!=='string'||!b.client||b.client.length>100||!Number.isInteger(b.choice)||b.choice<0||b.choice>=options.length)fail('اختار إجابة صحيحة.');
if(mode==='ranking'){
const c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM ranking_answers WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل استقبال الردود.',409);
const r=await env.DB.prepare("INSERT OR IGNORE INTO ranking_answers(code,client,choice,received) SELECT ?,?,?,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM ranking_answers WHERE code=?)<5000").bind(code,c,b.choice,code,now,code,code).run();if(!r.meta.changes)fail('استقبال الردود مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}
const c=await hash(b.client);const existing=await env.DB.prepare('SELECT 1 FROM votes WHERE code=? AND client=?').bind(code,c).first();if(existing)return json({ok:true,duplicate:true});if(!s.open)fail('المدرب قفل التصويت.',409);
const r=await env.DB.prepare('INSERT OR IGNORE INTO votes(code,client,choice) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND open=1 AND expires>?) AND NOT EXISTS (SELECT 1 FROM session_timers WHERE code=? AND ends_at<=CAST((julianday(\'now\')-2440587.5)*86400000 AS INTEGER)) AND (SELECT count(*) FROM votes WHERE code=?) < 5000').bind(code,c,b.choice,code,now,code,code).run();if(!r.meta.changes)fail('التصويت مقفول أو وصل للحد التجريبي.',409);return json({ok:true},201)}
if(action==='results'||action==='status'||action==='finish'){
const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer ')||await hash(auth.slice(7))!==s.token)fail('شاشة المدرب دي مش متاحة من المتصفح الحالي.',403);
if(action==='finish'&&req.method==='POST'&&ranking){await env.DB.batch([env.DB.prepare('UPDATE ranking_rounds SET ended=1 WHERE code=?').bind(ranking.group_code),env.DB.prepare('UPDATE sessions SET open=0 WHERE code IN (SELECT code FROM ranking_sessions WHERE group_code=?)').bind(ranking.group_code)]);return json({ok:true})}
if(action==='status'&&req.method==='POST'){const b=await body(req);if(typeof b.open!=='boolean')fail('حالة التصويت غير صحيحة.');if(b.open&&ranking?.ended)fail('الجولة انتهت. ابدأ جولة جديدة.',409);if(b.open&&timeUp)fail('الوقت خلص. ابدأ سيشن جديد لو عايز تكمل.',409);await env.DB.prepare('UPDATE sessions SET open=? WHERE code=?').bind(b.open?1:0,code).run();return json({ok:true})}
if(action==='results'&&req.method==='GET'){if(mode==='ranking'){
const all=await env.DB.prepare('SELECT a.id,a.client,a.choice,a.received,n.name FROM ranking_answers a LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE a.code=? ORDER BY a.received,a.id').bind(code).all();
const ids=await env.DB.prepare('SELECT a.client,MIN(a.id) AS first_id FROM ranking_answers a JOIN ranking_sessions r ON r.code=a.code WHERE r.group_code=? GROUP BY a.client ORDER BY first_id').bind(ranking.group_code).all();const counts=options.map((_,i)=>all.results.filter(a=>a.choice===i).length);const eligible=all.results.filter(a=>ranking.correct===null||a.choice===ranking.correct);let previous=null,rank=0;
const leaderboard=s.open?[]:eligible.map((a,i)=>{const elapsed=Math.max(0,a.received-ranking.started);if(elapsed!==previous)rank=i+1;previous=elapsed;return {rank,participant:ids.results.findIndex(x=>x.client===a.client)+1,...(identity==='named'?{name:a.name||''}:{}),choice:a.choice,elapsedMs:elapsed,points:Math.max(1,Math.floor(1000/rank))}});
const roundLeaderboard=ranking.ended?await roundScores(env.DB,ranking.group_code,identity):[];return json({...base,roundLeaderboard,counts,total:all.results.length,rankingReady:!s.open,correctChoice:ranking.correct,eligibleTotal:s.open?null:eligible.length,leaderboard})}
if(mode==='text'){const a=await env.DB.prepare(identity==='named'?'SELECT a.id,a.answer,a.created,n.name FROM text_answers a LEFT JOIN participant_names n ON n.code=a.code AND n.client=a.client WHERE a.code=? ORDER BY a.id DESC':'SELECT id,answer,created FROM text_answers WHERE code=? ORDER BY id DESC').bind(code).all();return json({...base,answers:a.results,total:a.results.length})}const r=await env.DB.prepare('SELECT choice,count(*) as n FROM votes WHERE code=? GROUP BY choice').bind(code).all();const counts=options.map((_,i)=>r.results.find(x=>x.choice===i)?.n||0);let respondents=[];if(identity==='named'){const n=await env.DB.prepare('SELECT n.name,v.choice FROM votes v JOIN participant_names n ON n.code=v.code AND n.client=v.client WHERE v.code=? ORDER BY v.rowid DESC').bind(code).all();respondents=n.results}return json({...base,counts,total:counts.reduce((a,b)=>a+b,0),...(identity==='named'?{respondents}:{})})}}
return json({error:'الطلب غير مسموح.'},405);
}catch(e){return json({error:e.status?e.message:'تعذّر الاتصال بالخدمة. جرّب تاني بعد قليل.'},e.status||503)}}
};


// CORS is browser read permission, not authentication. Existing trainer-token checks remain required.
const PAGES_ORIGIN = 'https://omarnagycd.github.io';
// Live push hub for one quiz game (Durable Object, free plan, SQLite-backed, hibernating WebSockets).
async function qnotify(env,code){try{if(env.ROOM)await env.ROOM.get(env.ROOM.idFromName(code)).fetch('https://room/notify?code='+code)}catch{}}
export class QuizRoom{
 constructor(state,env){this.s=state;this.env=env;try{state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))}catch{}}
 async fetch(req){const u=new URL(req.url),code=u.searchParams.get('code')||'';
  if(!/^\d{6}$/.test(code))return new Response('bad',{status:400});
  if(u.pathname==='/ws'){
   if(req.headers.get('Upgrade')!=='websocket')return new Response('expected websocket',{status:426});
   if(this.s.getWebSockets().length>=400)return new Response('full',{status:429});
   const pair=new WebSocketPair(),[c,s]=Object.values(pair);const raw=u.searchParams.get('c')||'',cl=raw?await hash(raw):'',att={c:cl,raw,code};
   this.s.acceptWebSocket(s);s.serializeAttachment(att);
   try{await this.sendTo(s,att)}catch{}
   return new Response(null,{status:101,webSocket:c})}
  if(u.pathname==='/notify'){await this.later(700);return new Response('ok')}
  return new Response('not found',{status:404})}
 async later(ms){const at=Date.now()+ms,cur=await this.s.storage.getAlarm();if(cur===null||cur>at)await this.s.storage.setAlarm(at)}
 async sendTo(ws,att){const d=await qpush(this.env.DB,att.code,Date.now());if(!d){ws.send(JSON.stringify({t:'gone'}));return}
  ws.send(JSON.stringify({t:'s',s:{...d.pub,me:d.me[att.c]||null}}));return d}
 async alarm(){const socks=this.s.getWebSockets();if(!socks.length)return;
  const first=socks[0].deserializeAttachment();const d=await qpush(this.env.DB,first.code,Date.now());
  if(!d){for(const w of socks){try{w.send(JSON.stringify({t:'gone'}))}catch{}}return}
  for(const w of socks){try{const a=w.deserializeAttachment()||{};w.send(JSON.stringify({t:'s',s:{...d.pub,me:d.me[a.c]||null}}))}catch{}}
  if(d.answering)await this.s.storage.setAlarm(Math.max(Date.now()+300,d.g.q_end+60))}
 async webSocketMessage(ws,msg){let b;try{b=JSON.parse(typeof msg==='string'?msg:'')}catch{return}
  const a=ws.deserializeAttachment()||{};
  if(b&&b.t==='a'){const now=Date.now(),path='/api/quiz/game/'+a.code+'/answer';
   try{const r=await qhandle(new Request('https://room'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...b.body,client:a.raw,qi:b.qi})}),this.env,path,new URL('https://room'+path),now);const j=await r.json().catch(()=>({}));ws.send(JSON.stringify({t:'ack',ok:r.ok,err:r.ok?undefined:(j.error||'')}))}catch(e){ws.send(JSON.stringify({t:'ack',ok:false,err:'error'}))}
   await this.later(900);return}
  if(b&&b.t==='r'){await this.sendTo(ws,a)}}
 async webSocketClose(ws){try{ws.close()}catch{}}
 async webSocketError(ws){try{ws.close()}catch{}}
}
export default {
 async fetch(req,env,ctx) {
  const url=new URL(req.url),origin=req.headers.get('Origin');
  const apiRoute=url.pathname.startsWith('/api/');
  const allowed=origin===PAGES_ORIGIN;
  if(apiRoute && req.method==='OPTIONS'){
   if(!allowed)return new Response(null,{status:403,headers:{'Vary':'Origin'}});
   const method=req.headers.get('Access-Control-Request-Method');
   const headers=(req.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
   if(!['GET','POST'].includes(method)||headers.some(h=>!['authorization','content-type'].includes(h)))return new Response(null,{status:403,headers:{'Vary':'Origin'}});
   return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':PAGES_ORIGIN,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}});
  }
  const response=await app.fetch(req,env,ctx);
  if(response.status===101)return response;
  if(!apiRoute||!allowed)return response;
  const out=new Response(response.body,response);out.headers.set('Access-Control-Allow-Origin',PAGES_ORIGIN);out.headers.set('Vary','Origin');return out;
 }
};
