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


const HTML="<!DOCTYPE html>\n\n<html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\"/><meta content=\"width=device-width, initial-scale=1\" name=\"viewport\"/><meta content=\"#E60000\" name=\"theme-color\"/><title>RoomPulse</title><style>\n*{box-sizing:border-box}body{margin:0;background:#fff;color:#252525;font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.85}main{max-width:1040px;margin:auto;padding:28px 24px 60px}header{border-top:5px solid #E60000;padding-top:24px;margin-bottom:28px}.eyebrow{font-size:13px;color:#E60000;font-weight:bold;letter-spacing:.2px}h1{font-weight:900;letter-spacing:-.8px;font-size:clamp(30px,5vw,46px);line-height:1.4;margin:10px 0}h2{font-size:24px;line-height:1.7;margin:8px 0 16px}h3{font-size:19px}p{margin:10px 0}a{color:#C90000;text-underline-offset:4px}button,.btn{font:inherit;padding:11px 20px;min-height:48px;border:1px solid #E60000;background:#E60000;color:white;border-radius:7px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center}button.secondary,.btn.secondary{color:#B90000;background:#fff}button:disabled{opacity:.45;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #252525;outline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.muted,small{color:#626262;font-size:14px}.notice{border:1px solid #ecdada;border-right:4px solid #E60000;padding:16px 18px;border-radius:6px;margin:20px 0;background:#fff8f8}.error{color:#AF0000}.card{border-top:1px solid #eadede;margin-top:30px;padding-top:28px}label{display:block;font-size:14px;font-weight:bold;margin-bottom:6px}textarea{font:inherit;line-height:1.8;min-height:150px;resize:vertical;width:100%;padding:14px;border:1px solid #c9bebe;border-radius:7px;color:#252525;background:#fff}textarea:focus-visible{outline:3px solid #252525;outline-offset:3px}.mode-buttons{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 24px}.mode-buttons button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.written-answer{padding:18px 20px;border:1px solid #eadede;border-radius:7px;background:#fffafa;white-space:pre-wrap;overflow-wrap:anywhere}.written-answer small{display:block;margin-bottom:8px;color:#A90000}input{font:inherit;padding:12px 14px;border:1px solid #c9bebe;background:#fff;border-radius:7px;width:100%;min-height:48px;color:#252525}.fields{display:grid;gap:17px;max-width:720px}.topnav{display:flex;justify-content:space-between;align-items:center;gap:12px}.topnav a{font-size:14px}.invite{display:grid;gap:24px;align-items:center}.code{font-size:clamp(38px,8vw,58px);font-weight:bold;letter-spacing:8px;line-height:1.5;color:#E60000;direction:ltr;text-align:right}.qrbox{margin:0;text-align:center}.qrbox img{width:208px;height:208px;max-width:100%;display:block;margin:auto}.qrbox figcaption{font-size:13px;color:#626262}.status{display:flex;align-items:center;gap:7px;font-size:13px;color:#626262;margin-bottom:12px}.dot{width:8px;height:8px;background:#E60000;border-radius:50%;display:inline-block}.metric{display:flex;align-items:baseline;gap:14px;margin:20px 0}.metric strong{font-size:46px;color:#E60000;line-height:1.3}.results{display:grid;gap:22px}.result-head{display:flex;justify-content:space-between;gap:14px;margin-bottom:8px}.result-head strong{white-space:nowrap;color:#C90000}.track{height:11px;background:#fff0f0;border-radius:5px;overflow:hidden}.bar{height:100%;background:#E60000;transition:width .3s}.choices{display:grid;gap:12px;margin:22px 0}.choice{width:100%;text-align:right;justify-content:flex-start;border-color:#d9cccc;color:#252525;background:#fff;padding:17px}.choice .number{display:grid;place-items:center;min-width:30px;height:30px;border-radius:5px;background:#fff0f0;color:#A90000}.choice.selected{border:2px solid #E60000;background:#fff5f5;padding:16px}.choice .answer{flex:1}.joincode{max-width:330px;font-size:26px;letter-spacing:6px;direction:ltr}.hidden{display:none!important}footer{margin-top:40px;padding-top:20px;border-top:1px solid #eadede;font-size:12px;color:#626262}.url{direction:ltr;display:block;overflow-wrap:anywhere;font-size:13px}#globalError:empty{display:none}#globalError{position:relative;padding:12px 16px;border:1px solid #E60000;border-radius:6px;background:#fff6f6;color:#A90000;margin-bottom:15px}.bank-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.bank-tabs button{font-size:14px;padding:8px 12px}.bank-list{display:grid;gap:10px;margin-bottom:20px}.bank-pick{background:#fff;color:#252525;border-color:#e6d5d5;text-align:start;justify-content:space-between;width:100%}.bank-pick span{flex:1}.bank-pick small{color:#a90000;white-space:nowrap}.bank-panel{margin:20px 0 30px;padding:20px;border:1px solid #eadede;border-radius:8px;background:#fffafa}.bank-panel summary{cursor:pointer;min-height:44px;font-weight:bold}.welcome-grid{display:grid;gap:20px}.welcome-grid>div{border:1px solid #eadede;padding:24px;border-radius:8px}.welcome-grid h2{font-size:23px}.success{font-weight:bold;color:#AE0000}#qrLink{display:inline-block}.header-intro{max-width:720px;color:#595959}@media(min-width:740px){main{padding:42px 54px 64px}.invite{grid-template-columns:1fr 250px}.welcome-grid{grid-template-columns:1fr 1fr}}@media(max-width:360px){main{padding:20px 16px}.result-head{flex-direction:column;gap:0}.code{letter-spacing:5px}.actions>*{width:100%}h2{font-size:21px}}\n\n.topnav-with-language{flex-wrap:wrap}.language-switch{display:flex;gap:4px;margin-inline-start:auto;flex-shrink:0;padding:3px;border:1px solid #eadede;border-radius:9px;background:#fff}.language-switch button{font-size:13px;font-weight:bold;min-height:40px;min-width:44px;padding:5px 10px;border-color:transparent}.language-switch button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.notice{border-right:1px solid #ecdada;border-inline-start:4px solid #E60000}.choice{text-align:start}.code{text-align:right}html[dir=\"ltr\"] .code{text-align:left}html[lang=\"en\"] body{font-family:Arial,Helvetica,sans-serif;line-height:1.65}html[lang=\"en\"] .eyebrow{letter-spacing:.5px}input[dir=\"auto\"],textarea[dir=\"auto\"]{text-align:start}.bank-tabs button[aria-pressed=\"true\"]{background:#E60000;color:white}.topnav>.eyebrow{flex:1;min-width:180px}.bank-panel{padding:18px}.bank-pick{overflow-wrap:anywhere}.fields{width:100%}@media(max-width:480px){main{padding:22px 18px 44px}.topnav>.eyebrow{flex-basis:100%;font-size:12px}.topnav>a{margin-inline-end:auto}.language-switch{margin-inline-start:0}.welcome-grid>div{padding:20px}.bank-panel{padding:14px}.bank-pick{padding:12px 10px}.bank-pick small{font-size:12px}.mode-buttons{gap:8px}.mode-buttons button{padding:9px 13px;font-size:14px}.qrbox img{width:208px;height:208px}.topnav{row-gap:9px}h1{margin-top:18px}}\n.timer-setup{max-width:720px;border:1px solid #eadede;border-radius:8px;padding:18px;margin:24px 0}.timer-setup h3{margin:0 0 8px}.timer-setup .mode-buttons{margin-bottom:10px}.timer-fields{display:flex;gap:12px;align-items:end;direction:ltr;max-width:330px}.timer-fields>div{flex:1;min-width:0}.timer-fields label{direction:inherit}.timer-fields input{text-align:center;font-variant-numeric:tabular-nums}.timer-separator{padding-bottom:10px;font-size:24px}.countdown{display:grid;grid-template-columns:1fr auto;gap:6px 18px;align-items:center;padding:16px 20px;border:1px solid #eed1d1;border-inline-start:4px solid #E60000;border-radius:8px;background:#fffafa;margin:18px 0 24px;max-width:720px}.countdown-value{font-size:34px;color:#E60000;line-height:1.2;font-variant-numeric:tabular-nums;white-space:nowrap}.countdown-label{font-weight:bold}.countdown-note{grid-column:1/-1;font-size:14px;margin:0}.countdown.urgent{border-color:#E60000;background:#fff2f2}.countdown.expired .countdown-value{color:#666}.countdown.expired{background:#fafafa;border-color:#ccc}@media(max-width:360px){.countdown{padding:14px;gap:8px}.countdown-value{font-size:28px}.timer-setup{padding:14px}}\n\n.theme-toggle{font-size:13px;min-height:44px;padding:6px 12px;gap:7px;white-space:nowrap}.theme-icon{font-size:22px;line-height:1}.topnav-with-language{gap:10px}.language-switch{margin-inline-start:auto}html[data-theme=\"dark\"] body{background:#141414;color:#f2eeee}html[data-theme=\"dark\"] a{color:#ff9292}html[data-theme=\"dark\"] .header-intro,html[data-theme=\"dark\"] .muted,html[data-theme=\"dark\"] small,html[data-theme=\"dark\"] .status,html[data-theme=\"dark\"] .qrbox figcaption,html[data-theme=\"dark\"] footer{color:#c2baba}html[data-theme=\"dark\"] .eyebrow,html[data-theme=\"dark\"] .success,html[data-theme=\"dark\"] .error,html[data-theme=\"dark\"] .result-head strong,html[data-theme=\"dark\"] .metric strong,html[data-theme=\"dark\"] .code,html[data-theme=\"dark\"] .countdown-value{color:#ff9292}html[data-theme=\"dark\"] input,html[data-theme=\"dark\"] textarea{background:#202020;border-color:#685252;color:#f2eeee}html[data-theme=\"dark\"] input::placeholder,html[data-theme=\"dark\"] textarea::placeholder{color:#bcb0b0}html[data-theme=\"dark\"] .welcome-grid>div,html[data-theme=\"dark\"] .card,html[data-theme=\"dark\"] footer,html[data-theme=\"dark\"] .timer-setup{border-color:#4f3b3b}html[data-theme=\"dark\"] .bank-panel,html[data-theme=\"dark\"] .notice,html[data-theme=\"dark\"] .written-answer,html[data-theme=\"dark\"] .countdown{background:#261c1c;border-color:#634343;border-inline-start-color:#E60000}html[data-theme=\"dark\"] .bank-pick,html[data-theme=\"dark\"] .choice{background:#202020;color:#f2eeee;border-color:#634343}html[data-theme=\"dark\"] .bank-pick small,html[data-theme=\"dark\"] .written-answer small{color:#ffaaaa}html[data-theme=\"dark\"] .choice.selected{background:#3a1b1b;border-color:#E60000}html[data-theme=\"dark\"] .choice .number,html[data-theme=\"dark\"] .track{background:#4b2525;color:#ffb0b0}html[data-theme=\"dark\"] button.secondary,html[data-theme=\"dark\"] a.btn.secondary{background:transparent;color:#ffaaaa;border-color:#b14c4c}html[data-theme=\"dark\"] .mode-buttons button[aria-pressed=\"true\"],html[data-theme=\"dark\"] .bank-tabs button[aria-pressed=\"true\"],html[data-theme=\"dark\"] .language-switch button[aria-pressed=\"true\"]{background:#E60000;color:#fff;border-color:#E60000}html[data-theme=\"dark\"] .language-switch{background:#202020;border-color:#634343}html[data-theme=\"dark\"] .language-switch button{border-color:transparent}html[data-theme=\"dark\"] #qrLink{background:white;padding:10px;border-radius:8px}html[data-theme=\"dark\"] #globalError{background:#361d1d;color:#ffc1c1}html[data-theme=\"dark\"] button:focus-visible,html[data-theme=\"dark\"] a:focus-visible,html[data-theme=\"dark\"] input:focus-visible,html[data-theme=\"dark\"] textarea:focus-visible{outline-color:#fff}html[data-theme=\"dark\"] .countdown.urgent{background:#391b1b;border-color:#E60000}html[data-theme=\"dark\"] .countdown.expired{background:#222;border-color:#666}html[data-theme=\"dark\"] .countdown.expired .countdown-value{color:#bbb}@media(max-width:480px){.topnav-with-language{gap:8px}.topnav>a{margin-inline-end:auto}.language-switch{margin-inline-start:0}.theme-toggle{padding:5px 9px;font-size:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}\nhtml[dir=\"rtl\"] .fields input:placeholder-shown{text-align:right}html[dir=\"ltr\"] .fields input:placeholder-shown{text-align:left}\nselect{width:100%;padding:14px;border:1px solid #bbb;border-radius:12px;font:inherit;background:var(--surface,#fff);color:inherit}html[data-theme=\"dark\"] select{background:#202126;color:#fff}.ranking-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:start;gap:10px;padding:14px 0;border-bottom:1px solid #8884}.ranking-row small{display:block;margin-top:5px}.ranking-place{font-weight:900;color:#E60000;font-size:1.3rem}.ranking-row strong{overflow-wrap:anywhere}.ranking-points{text-align:end;white-space:nowrap;font-weight:800}\n\n.section-tabs{margin-block:16px 24px}.section-tabs button[aria-pressed=\"true\"]{background:#E60000;color:#fff}.wheel-layout{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(280px,1.2fr);gap:32px;align-items:start}.wheel-stage{text-align:center}.wheel-stage canvas{display:block;width:100%;max-width:560px;height:auto;aspect-ratio:1;margin:0 auto 18px}.wheel-editor textarea{min-height:250px;resize:vertical;line-height:1.7}.wheel-result{margin-top:22px;padding:20px;border:2px solid #E60000;border-radius:18px;background:#fff5f5}.wheel-result p{margin:0 0 10px}.wheel-result strong{display:block;font-size:clamp(1.4rem,5vw,2.2rem);overflow-wrap:anywhere;color:#B60000}html[data-theme=\"dark\"] .wheel-result{background:#2d171b}html[data-theme=\"dark\"] .wheel-result strong{color:#ff9b9b}@media(max-width:700px){.wheel-layout{grid-template-columns:minmax(0,1fr);gap:24px}.wheel-editor textarea{min-height:180px}.wheel-stage{min-width:0}}\n/* RoomPulse: visual-only red/white glass system. No activity or data changes. */\n:root{--glass-surface:linear-gradient(140deg,#fffffff0,#ffffff85);--glass-line:#ffffffef;--glass-inset:#ffffff;--glass-shadow:0 18px 50px #7b15200c,inset 0 1px 0 #fff;--glass-ink:#30242a;--glass-muted:#6b5960;--glass-accent:#d90016;--glass-field:#ffffffb8;--glass-field-line:#d9b9c0}html{background:#fff3f4}body{min-height:100vh;color:var(--glass-ink);background:radial-gradient(ellipse at 0% 8%,#f6b2bc6b,transparent 43%),radial-gradient(ellipse at 100% 48%,#f5d5d982,transparent 42%),radial-gradient(ellipse at 8% 90%,#f1e7ec,transparent 43%),linear-gradient(145deg,#fff9fa,#f8ecef);background-attachment:fixed}main{max-width:1160px;padding-top:34px}header{border:1px solid var(--glass-line);border-top:1px solid var(--glass-line);background:var(--glass-surface);backdrop-filter:blur(26px) saturate(145%);-webkit-backdrop-filter:blur(26px) saturate(145%);padding:28px 32px;border-radius:30px;box-shadow:var(--glass-shadow);position:relative;overflow:hidden}header:before{content:\"\";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 0% 0%,#fff9,transparent 68%);z-index:0}header>*{position:relative}header h1{letter-spacing:-1.6px;font-weight:900;margin-top:22px}.header-intro{max-width:780px;color:var(--glass-muted)}.topnav-with-language{padding-bottom:16px;border-bottom:1px solid #b73a4a16}.topnav>a{font-weight:700;text-decoration:none}.language-switch{background:#ffffff61;border:1px solid var(--glass-line);border-radius:18px;box-shadow:inset 0 1px 0 var(--glass-inset);padding:4px}.language-switch button{border-radius:13px;box-shadow:none}.section-tabs{display:flex;gap:8px;width:max-content;max-width:100%;padding:6px;border:1px solid var(--glass-line);background:var(--glass-surface);backdrop-filter:blur(24px);border-radius:22px;box-shadow:var(--glass-shadow)}.section-tabs button{min-width:110px;border-radius:16px!important}.card,.welcome-grid>div,.bank-panel,.timer-setup,.countdown,.written-answer,.wheel-result{border:1px solid var(--glass-line);border-radius:26px;background:var(--glass-surface);box-shadow:var(--glass-shadow);backdrop-filter:blur(24px) saturate(130%);-webkit-backdrop-filter:blur(24px) saturate(130%)}.welcome-grid{gap:24px}.welcome-grid>div{padding:28px 30px}.welcome-grid h2{font-size:26px;letter-spacing:-.6px}.welcome-grid>div>p{color:var(--glass-muted)}.card{padding:28px 30px;margin-top:26px}.bank-panel{padding:22px}.timer-setup{padding:22px}.notice{background:#fff8f8a8;border:1px solid #e8b6bf88;border-inline-start:4px solid #e60000;border-radius:20px;color:var(--glass-muted);backdrop-filter:blur(20px)}button,.btn{border-radius:16px;border:1px solid #e60000;background:linear-gradient(145deg,#ef2234,#d90016);color:#fff;box-shadow:0 6px 16px #a71c2b16,inset 0 1px 0 #ffffff40;transition:box-shadow .2s,background .2s,border-color .2s}button:hover:not(:disabled),.btn:hover{box-shadow:0 8px 22px #a71c2b24,inset 0 1px 0 #ffffff55}button.secondary,.btn.secondary{background:linear-gradient(145deg,#ffffffe3,#ffffff61);border-color:var(--glass-line);color:#ad0015;box-shadow:0 5px 15px #78223609,inset 0 1px 0 var(--glass-inset);backdrop-filter:blur(18px)}.mode-buttons button[aria-pressed=true],.bank-tabs button[aria-pressed=true],.language-switch button[aria-pressed=true],.section-tabs button[aria-pressed=true]{background:linear-gradient(145deg,#ef2234,#d90016);border-color:#e60000;color:#fff;box-shadow:0 6px 18px #a71c2b24,inset 0 1px 0 #ffffff45}input,textarea,select{background:var(--glass-field);border:1px solid var(--glass-field-line);border-radius:16px;color:var(--glass-ink);box-shadow:inset 0 2px 4px #59344205;backdrop-filter:blur(12px)}input::placeholder,textarea::placeholder{color:#89767e}input:focus-visible,textarea:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #b50018;outline-offset:3px}.bank-pick,.choice{background:var(--glass-field);border:1px solid #f5ffffee;border-radius:18px;color:var(--glass-ink);box-shadow:0 4px 14px #5f152506,inset 0 1px 0 var(--glass-inset)}.bank-pick{padding:14px 18px}.choice{padding:18px}.choice.selected{border:2px solid #e60000;background:#fff0f4e8;padding:17px}.choice .number{border-radius:11px;background:#ffe4e9;color:#ad0015}.track{height:12px;border:1px solid #ffffff90;background:#b7233810;border-radius:12px}.bar{background:linear-gradient(90deg,#e60000,#f36273);border-radius:12px}.qrbox{background:#fff;border:1px solid #fff;border-radius:24px;padding:20px;box-shadow:0 15px 35px #5e233015}.qrbox img{background:#fff;image-rendering:auto}.qrbox figcaption{color:#66565c}html[data-theme=dark] #qrLink{padding:0;border-radius:0}.code{color:#dc0018;font-variant-numeric:tabular-nums}.ranking-row{padding:17px 12px;border-bottom:1px solid #b94b5c20;border-radius:12px}.ranking-place{color:#e60000}.metric{padding:18px 22px;border-radius:20px;background:#ffffff51;border:1px solid var(--glass-line);width:max-content;max-width:100%}.wheel-stage{border:1px solid var(--glass-line);border-radius:28px;padding:20px;background:var(--glass-surface);box-shadow:var(--glass-shadow);backdrop-filter:blur(25px)}.wheel-editor{min-width:0}.wheel-result{border:2px solid #e60000}.countdown{border-inline-start:4px solid #e60000}.countdown.urgent{background:#ffe1e8db;border-color:#e60000}.countdown.expired{background:#f6f0f3c9;border-color:#99868e}.written-answer{padding:20px 24px}.muted,small,.status,footer{color:var(--glass-muted)}footer{border-color:#b8556825;padding-inline:12px}#globalError{background:#fff0f2ed;border-radius:16px;border-color:#e60000}h2{letter-spacing:-.5px}.topnav,.fields,.bank-list,.results,.wheel-layout{min-width:0}select{appearance:auto}\nhtml[data-theme=dark]{--glass-surface:linear-gradient(140deg,#fff1f416,#f0d2da06);--glass-line:#ffe0e933;--glass-inset:#fff4f421;--glass-shadow:0 18px 50px #0002,inset 0 1px 0 #ffffff1d;--glass-ink:#f6edf0;--glass-muted:#cbb9c1;--glass-field:#fff1f40b;--glass-field-line:#d4a9b64d;background:#1b1117}html[data-theme=dark] body{background:radial-gradient(ellipse at 0% 8%,#8e15374b,transparent 43%),radial-gradient(ellipse at 100% 48%,#64374645,transparent 45%),linear-gradient(145deg,#23151c,#171319);color:var(--glass-ink)}html[data-theme=dark] header:before{background:radial-gradient(ellipse at 0% 0%,#ffeff507,transparent 68%)}html[data-theme=dark] .topnav-with-language{border-color:#ffe0e918}html[data-theme=dark] .card,html[data-theme=dark] .welcome-grid>div,html[data-theme=dark] .bank-panel,html[data-theme=dark] .timer-setup,html[data-theme=dark] .countdown,html[data-theme=dark] .written-answer,html[data-theme=dark] .wheel-result{background:var(--glass-surface);border-color:var(--glass-line)}html[data-theme=dark] .language-switch{background:#ffffff06;border-color:var(--glass-line)}html[data-theme=dark] button.secondary,html[data-theme=dark] .btn.secondary{background:linear-gradient(145deg,#fff1f413,#fff1f403);border-color:var(--glass-line);color:#ffb1c1}html[data-theme=dark] .mode-buttons button[aria-pressed=true],html[data-theme=dark] .bank-tabs button[aria-pressed=true],html[data-theme=dark] .language-switch button[aria-pressed=true]{background:linear-gradient(145deg,#ef2234,#d90016);border-color:#e60000;color:#fff}html[data-theme=dark] input,html[data-theme=dark] textarea,html[data-theme=dark] select,html[data-theme=dark] .bank-pick,html[data-theme=dark] .choice{background:var(--glass-field);border-color:var(--glass-field-line);color:var(--glass-ink)}html[data-theme=dark] select option{background:#2d1f28;color:#fff}html[data-theme=dark] input::placeholder,html[data-theme=dark] textarea::placeholder{color:#b5a2ab}html[data-theme=dark] .notice{background:#ffb7ca08;border-color:#ffb7ca35;border-inline-start-color:#e60000;color:var(--glass-muted)}html[data-theme=dark] .choice.selected{background:#ad234b35;border-color:#ff6b87}html[data-theme=dark] .choice .number{background:#ff809923;color:#ffc0cd}html[data-theme=dark] .track{background:#ff83951c}html[data-theme=dark] .metric{background:#ffffff06;border-color:var(--glass-line)}html[data-theme=dark] .countdown.urgent{background:#941b3d3b;border-color:#ef4965}html[data-theme=dark] .countdown.expired{background:#3e303a55;border-color:#9b8790}html[data-theme=dark] .ranking-row{border-color:#ffe0e91c}html[data-theme=dark] .qrbox{border-color:#fff;background:#fff}html[data-theme=dark] .qrbox figcaption{color:#66565c}html[data-theme=dark] footer{border-color:#ffe0e924}html[data-theme=dark] #globalError{background:#501a2bda;color:#ffd6e0}html[data-theme=dark] input:focus-visible,html[data-theme=dark] textarea:focus-visible,html[data-theme=dark] select:focus-visible,html[data-theme=dark] button:focus-visible,html[data-theme=dark] a:focus-visible{outline-color:#ffbbc9}\n@media(max-width:700px){main{padding:20px 16px 40px}header{padding:21px 20px;border-radius:26px}.topnav-with-language{gap:8px}header h1{font-size:38px;letter-spacing:-1.2px;margin-top:22px}.header-intro{font-size:14px;line-height:1.85}.welcome-grid>div,.card{padding:23px 20px;border-radius:25px}.bank-panel,.timer-setup{padding:17px;border-radius:21px}.welcome-grid h2{font-size:23px}.section-tabs{width:100%;justify-content:stretch}.section-tabs button{flex:1;min-width:0}.language-switch button{min-width:42px;padding:5px 8px}.theme-toggle{font-size:12px;padding:6px 9px}.topnav>a{font-size:13px}.wheel-stage{padding:15px}.wheel-layout{gap:24px}.bank-pick{padding:13px 12px}.qrbox{max-width:300px;width:100%;margin:auto}.countdown{padding:16px}.code{letter-spacing:6px}.choice{padding:16px}.choice.selected{padding:15px}.written-answer{padding:18px}.metric{padding:15px 18px}}@media(prefers-reduced-transparency:reduce){:root{--glass-surface:#fff;--glass-field:#fff}html[data-theme=dark]{--glass-surface:#2d2028;--glass-field:#30222b}}@media(prefers-reduced-motion:reduce){button,.btn,.bar{transition:none!important}}\n\n\n/* Animated red-glass section navigation */\n.section-tabs{position:relative;isolation:isolate;overflow:visible;--pill-x:6px;--pill-w:110px;--pill-h:44px;--pill-y:6px}\n.section-tabs::before{content:\"\";position:absolute;left:0;top:0;width:var(--pill-w);height:var(--pill-h);transform:translate3d(var(--pill-x),var(--pill-y),0);border-radius:17px;background:linear-gradient(135deg,#ff4357d9 0%,#ed1029ed 48%,#bd001cf5 100%);border:1px solid #ffffffb5;box-shadow:0 8px 24px #b9002938,inset 0 1px 2px #ffffffc2,inset 0 -2px 7px #88001936;backdrop-filter:blur(18px) saturate(145%);pointer-events:none;z-index:0;transition:transform .48s cubic-bezier(.22,1.1,.32,1),width .48s cubic-bezier(.22,1.1,.32,1),height .3s}\n.section-tabs button,.section-tabs button[aria-pressed=true],html[data-theme=dark] .section-tabs button,html[data-theme=dark] .section-tabs button[aria-pressed=true]{position:relative;z-index:1;background:transparent!important;border:1px solid transparent!important;box-shadow:none!important;color:var(--glass-ink);transition:color .22s ease,transform .2s ease;min-height:44px}\n.section-tabs button[aria-pressed=true],html[data-theme=dark] .section-tabs button[aria-pressed=true]{color:white;text-shadow:0 1px 4px #80001d40}\n.section-tabs button:hover{transform:translateY(-1px);background:#ffffff16!important}.section-tabs button:active{transform:scale(.97)}\n.section-tabs button:focus-visible{outline:3px solid #c30028;outline-offset:4px}\nhtml[data-theme=dark] .section-tabs::before{background:linear-gradient(135deg,#ff687ec9,#ed1833e8 45%,#b8002ee8);box-shadow:0 8px 28px #ed123135,inset 0 1px 2px #ffffffbc,inset 0 -2px 7px #8a001d40}\n@media(prefers-reduced-motion:reduce){.section-tabs::before,.section-tabs button{transition:none!important}}\n/* QUIZ MODULE */\n#quiz,#quizPlay{--qa0:#E60000;--qa1:#30242a;--qa2:#b3001b;--qa3:#7a6068;--qa4:#c4455a;--qa5:#4a3a40}\n.qglass{background:var(--glass-surface,linear-gradient(140deg,#fffffff0,#ffffff85));border:1px solid var(--glass-line,#ffffffef);border-radius:20px;box-shadow:var(--glass-shadow,0 18px 50px #7b15200c);padding:20px;margin:16px 0;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}\n.qrow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}\n.qrow.between{justify-content:space-between}\n.qitem{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;border:1px solid var(--glass-field-line,#d9b9c0);background:var(--glass-field,#ffffffb8);border-radius:14px;padding:14px 16px;margin:10px 0}\n.qitem small{display:block;color:var(--glass-muted,#6b5960)}\n.qbtn-danger{border-color:#30242a!important;color:#30242a!important;background:transparent!important}\n.qtag{display:inline-block;background:#E60000;color:#fff;border-radius:99px;padding:1px 12px;font-size:13px;font-weight:bold}\n.qtag.dark{background:#30242a}\n.qcode{font-size:clamp(40px,10vw,68px);font-weight:900;letter-spacing:8px;color:#E60000;direction:ltr;line-height:1.3}\n.qchips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}\n.qchip{border:1px solid #E60000;color:var(--glass-accent,#B90000);border-radius:99px;padding:2px 12px;font-size:14px}\n.qq{font-size:clamp(20px,3.6vw,30px);font-weight:900;line-height:1.6;margin:14px 0}\n.qans{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:14px 0}\n.qa{border-radius:16px;padding:18px;color:#fff;font-weight:bold;font-size:18px;min-height:66px;display:flex;align-items:center;gap:12px;border:3px solid transparent;text-align:start;position:relative}\n.qa.c0{background:var(--qa0)}.qa.c1{background:var(--qa1)}.qa.c2{background:var(--qa2)}.qa.c3{background:var(--qa3)}.qa.c4{background:var(--qa4)}.qa.c5{background:var(--qa5)}\n.qa.right{border-color:#1a9c4b;box-shadow:0 0 0 3px #1a9c4b55}.qa.dim{opacity:.4}\nbutton.qa{cursor:pointer;width:100%;font:inherit;font-weight:bold;font-size:18px}\nbutton.qa:disabled{opacity:.55}\nbutton.qa.picked{border-color:#fff;box-shadow:0 0 0 4px #252525}\n.qa .sym{font-size:22px;min-width:26px;text-align:center}\n.qa .cnt{margin-inline-start:auto;font-size:22px}\n.qtimer{width:68px;height:68px;border-radius:50%;border:6px solid #E60000;display:grid;place-items:center;font-size:26px;font-weight:900;color:#E60000;background:var(--glass-field,#fff);direction:ltr}\n.qbar{height:10px;border-radius:6px;background:#E6000020;overflow:hidden;margin:10px 0}.qbar>i{display:block;height:100%;background:#E60000;transition:width .3s}\n.qlb .r{display:flex;justify-content:space-between;gap:10px;background:var(--glass-field,#ffffffc0);border-radius:12px;padding:10px 16px;margin:8px 0;font-weight:bold}\n.qlb .r.me{outline:2px solid #E60000}\n.qpod{direction:ltr;display:flex;gap:12px;align-items:flex-end;justify-content:center;height:250px;margin:16px 0}\n.qpod>div{flex:1;max-width:160px;border-radius:14px 14px 0 0;text-align:center;color:#fff;font-weight:900;padding:10px 6px;overflow-wrap:anywhere}\n.qpod .p1{background:#E60000;height:100%}.qpod .p2{background:#7a6068;height:70%}.qpod .p3{background:#b3001b;height:52%}\n.qcloud{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;align-items:center;padding:20px;line-height:1.3}\n.qbub{background:var(--glass-field,#fff);border:2px solid var(--glass-field-line,#d9b9c0);border-radius:16px;padding:12px 16px;margin:8px 0;width:100%;text-align:start;font:inherit;cursor:pointer;color:inherit}\n.qbub.picked{border-color:#E60000;background:#E6000014}.qbub.right{border-color:#1a9c4b;background:#eafaf0;color:#1c1c1c}.qbub.wrong{opacity:.55}\n.qqcard{border:1px solid var(--glass-field-line,#d9b9c0);border-radius:16px;padding:16px;margin:14px 0;background:var(--glass-field,#ffffff80)}\n.qopt{display:flex;gap:8px;align-items:center;margin:8px 0}.qopt input[type=radio]{width:22px;min-height:22px;flex:none}.qopt input[type=text]{flex:1}\n.qbig{font-size:64px;line-height:1.2;text-align:center}\n.qcenter{text-align:center}\n.qok{color:#1a9c4b}.qno{color:#E60000}\n.qbadge{font-size:13px;color:var(--glass-muted,#6b5960)}\n@media(max-width:560px){.qa{font-size:17px;padding:16px}.qpod{height:200px}}\n</style></head><body><main><header><div class=\"topnav topnav-with-language\"><a href=\"/\"><span data-i18n=\"البداية\">البداية</span></a><div aria-label=\"Language / اللغة\" class=\"language-switch\" dir=\"ltr\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"langAR\" lang=\"ar\" type=\"button\">AR</button><button aria-pressed=\"false\" class=\"secondary\" id=\"langEN\" lang=\"en\" type=\"button\">EN</button></div><button aria-pressed=\"false\" class=\"secondary theme-toggle\" id=\"themeToggle\" type=\"button\"><span aria-hidden=\"true\" class=\"theme-icon\">◐</span><span id=\"themeLabel\">الوضع الداكن</span></button></div><h1><bdi><strong>RoomPulse</strong></bdi></h1><p class=\"header-intro\"><span data-i18n=\"سؤال واحد، كود واحد، ونقاش يشارك فيه الكل. بالاسم أو من غيره، ومن غير تسجيل حساب.\">سؤال واحد، كود واحد، ونقاش يشارك فيه الكل. بالاسم أو من غيره، ومن غير تسجيل حساب.</span></p></header><nav aria-label=\"App sections\" class=\"mode-buttons section-tabs\"><button aria-pressed=\"true\" class=\"secondary\" id=\"activitiesTab\" type=\"button\"><span data-i18n=\"الأنشطة\">الأنشطة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"wheelTab\" type=\"button\"><span data-i18n=\"العجلة\">العجلة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"quizTab\" type=\"button\"><span data-i18n=\"كويز\">كويز</span></button></nav><div id=\"globalError\" role=\"alert\"></div>\n<section id=\"welcome\"><div class=\"welcome-grid\"><div><span class=\"eyebrow\"><span data-i18n=\"للمدرب\">للمدرب</span></span><h2><span data-i18n=\"اسمع رأي القاعة\">اسمع رأي القاعة</span></h2><p><span data-i18n=\"اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.\">اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.</span></p><div class=\"actions\"><button id=\"startTrainer\"><span data-i18n=\"جهّز سؤال\">جهّز سؤال</span></button></div></div><div><span class=\"eyebrow\"><span data-i18n=\"للمتدرب\">للمتدرب</span></span><h2><span data-i18n=\"جاهز تشارك؟\">جاهز تشارك؟</span></h2><p><span data-i18n=\"معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.\">معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.</span></p><div class=\"actions\"><a class=\"btn secondary\" href=\"/join\"><span data-i18n=\"ادخل بكود السيشن\">ادخل بكود السيشن</span></a></div></div></div><section class=\"card\"><h2><span data-i18n=\"لف واختار\">لف واختار</span></h2><p><span data-i18n=\"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\">اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.</span></p><button id=\"openWheel\"><span data-i18n=\"العجلة\">العجلة</span></button></section><section class=\"card\"><span class=\"eyebrow\"><span data-i18n=\"للمدرب · القسم الثالث\">للمدرب · القسم الثالث</span></span><h2><span data-i18n=\"بنك أسئلة جاهزة\">بنك أسئلة جاهزة</span></h2><p><span data-i18n=\"٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.\">٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.</span></p><button class=\"secondary\" id=\"openBank\"><span data-i18n=\"اختار من بنك الأسئلة\">اختار من بنك الأسئلة</span></button></section><div class=\"notice hidden\" id=\"resumeBox\"><p><span data-i18n=\"عندك سيشن مفتوح على المتصفح ده.\">عندك سيشن مفتوح على المتصفح ده.</span></p><button class=\"secondary\" id=\"resume\"><span data-i18n=\"ارجع لشاشة المدرب\">ارجع لشاشة المدرب</span></button></div><div class=\"notice\"><strong><span data-i18n=\"نسخة أولية لايف\">نسخة أولية لايف</span></strong><p><span data-i18n=\"تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.\">تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.</span></p></div></section>\n<section class=\"hidden\" id=\"setup\"><span class=\"eyebrow\"><span data-i18n=\"من غير ما تنقل محتواك\">من غير ما تنقل محتواك</span></span><h2><span data-i18n=\"جهّز سؤال واحد\">جهّز سؤال واحد</span></h2><div class=\"notice hidden\" id=\"continuingRanking\"><p><span data-i18n=\"جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.\">جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.</span></p><button class=\"secondary\" id=\"separateRanking\" type=\"button\"><span data-i18n=\"ابدأ جولة منفصلة بدل دي\">ابدأ جولة منفصلة بدل دي</span></button></div><details class=\"bank-panel\" id=\"bankPanel\"><summary><span data-i18n=\"اختار من بنك الأسئلة · ٥٠ سؤال\">اختار من بنك الأسئلة · ٥٠ سؤال</span></summary><p class=\"muted\"><span data-i18n=\"اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.\">اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.</span></p><div aria-label=\"أقسام بنك الأسئلة\" class=\"bank-tabs\" data-i18n-aria-label=\"أقسام بنك الأسئلة\" id=\"bankTabs\" role=\"group\"></div><p id=\"bankCategory\"></p><div class=\"bank-list\" id=\"bankList\"></div><p class=\"success\" id=\"bankSelected\" role=\"status\"></p></details><label><span data-i18n=\"هوية المشاركين\">هوية المشاركين</span></label><div aria-label=\"هوية المشاركين\" class=\"mode-buttons\" data-i18n-aria-label=\"هوية المشاركين\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"identityAnonymous\"><span data-i18n=\"من غير أسماء\">من غير أسماء</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"identityNamed\"><span data-i18n=\"بالأسماء\">بالأسماء</span></button></div><p class=\"muted\" id=\"identityHint\"><span data-i18n=\"هتشوف الردود من غير أسماء، زي الوضع الحالي.\">هتشوف الردود من غير أسماء، زي الوضع الحالي.</span></p><label><span data-i18n=\"نوع الإجابة\">نوع الإجابة</span></label><div aria-label=\"نوع الإجابة\" class=\"mode-buttons\" data-i18n-aria-label=\"نوع الإجابة\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"modePoll\"><span data-i18n=\"اختيارات\">اختيارات</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"modeText\"><span data-i18n=\"إجابة مكتوبة\">إجابة مكتوبة</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"modeRanking\" type=\"button\"><span data-i18n=\"رانكينج\">رانكينج</span></button></div><p class=\"muted\" id=\"modeHint\"><span data-i18n=\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\">المتدرب يختار إجابة واحدة من ٣ اختيارات.</span></p><section class=\"card hidden\" id=\"rankingSetup\"><h3><span data-i18n=\"إعدادات الرانكينج\">إعدادات الرانكينج</span></h3><p><span data-i18n=\"في إجابة صح؟\">في إجابة صح؟</span></p><div class=\"mode-buttons\"><button aria-pressed=\"true\" class=\"secondary\" id=\"rankingNoCorrect\" type=\"button\"><span data-i18n=\"من غير إجابة صح\">من غير إجابة صح</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"rankingHasCorrect\" type=\"button\"><span data-i18n=\"في إجابة صح\">في إجابة صح</span></button></div><div class=\"hidden\" id=\"correctChoiceBox\"><label for=\"correctChoice\"><span data-i18n=\"اختار الإجابة الصحيحة\">اختار الإجابة الصحيحة</span></label><select id=\"correctChoice\"><option data-i18n=\"اختار الإجابة الصحيحة\" value=\"\">اختار الإجابة الصحيحة</option><option data-i18n=\"الاختيار الأول\" value=\"0\">الاختيار الأول</option><option data-i18n=\"الاختيار الثاني\" value=\"1\">الاختيار الثاني</option><option data-i18n=\"الاختيار الثالث\" value=\"2\">الاختيار الثالث</option></select></div><p class=\"muted\"><span data-i18n=\"الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.\">الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.</span></p><p class=\"muted\"><span data-i18n=\"النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.\">النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.</span></p><p class=\"muted\"><span data-i18n=\"كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.\">كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.</span></p></section><section aria-labelledby=\"timerHeading\" class=\"timer-setup\"><h3 id=\"timerHeading\"><span data-i18n=\"مؤقت السؤال\">مؤقت السؤال</span></h3><div aria-label=\"Question timer\" class=\"mode-buttons\" role=\"group\"><button aria-pressed=\"true\" class=\"secondary\" id=\"timerOff\" type=\"button\"><span data-i18n=\"من غير مؤقت\">من غير مؤقت</span></button><button aria-pressed=\"false\" class=\"secondary\" id=\"timerOn\" type=\"button\"><span data-i18n=\"بمؤقت\">بمؤقت</span></button></div><div class=\"hidden\" id=\"timerDuration\"><div class=\"timer-fields\"><div><label for=\"timerMinutes\"><span data-i18n=\"دقائق\">دقائق</span></label><input dir=\"ltr\" id=\"timerMinutes\" inputmode=\"numeric\" max=\"1439\" min=\"0\" step=\"1\" type=\"number\" value=\"1\"/></div><span aria-hidden=\"true\" class=\"timer-separator\">:</span><div><label for=\"timerSeconds\"><span data-i18n=\"ثواني\">ثواني</span></label><input dir=\"ltr\" id=\"timerSeconds\" inputmode=\"numeric\" max=\"59\" min=\"0\" step=\"1\" type=\"number\" value=\"0\"/></div></div><p class=\"muted\"><span data-i18n=\"قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.\">قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.</span></p></div><p class=\"muted\"><span data-i18n=\"المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.\">المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.</span></p></section><div class=\"fields\"><div><label for=\"title\"><span data-i18n=\"عنوان السيشن\">عنوان السيشن</span></label><input data-i18n-placeholder=\"اكتب عنوان السيشن\" dir=\"auto\" id=\"title\" maxlength=\"80\" placeholder=\"اكتب عنوان السيشن\" value=\"\"/></div><div><label for=\"question\"><span data-i18n=\"سؤال النقاش\">سؤال النقاش</span></label><input data-i18n-placeholder=\"اكتب سؤالك هنا\" dir=\"auto\" id=\"question\" maxlength=\"300\" placeholder=\"اكتب سؤالك هنا\" value=\"\"/></div><div class=\"option-field\"><label for=\"option0\"><span data-i18n=\"الاختيار ١\">الاختيار ١</span></label><input data-i18n-placeholder=\"اكتب الاختيار الأول\" dir=\"auto\" id=\"option0\" maxlength=\"200\" placeholder=\"اكتب الاختيار الأول\" value=\"\"/></div><div class=\"option-field\"><label for=\"option1\"><span data-i18n=\"الاختيار ٢\">الاختيار ٢</span></label><input data-i18n-placeholder=\"اكتب الاختيار الثاني\" dir=\"auto\" id=\"option1\" maxlength=\"200\" placeholder=\"اكتب الاختيار الثاني\" value=\"\"/></div><div class=\"option-field\" id=\"thirdOption\"><label for=\"option2\"><span data-i18n=\"الاختيار ٣\">الاختيار ٣</span></label><input data-i18n-placeholder=\"اكتب الاختيار الثالث\" dir=\"auto\" id=\"option2\" maxlength=\"200\" placeholder=\"اكتب الاختيار الثالث\" value=\"\"/></div></div><div class=\"actions\"><button id=\"create\"><span data-i18n=\"افتح السيشن اللايف\">افتح السيشن اللايف</span></button><a class=\"btn secondary\" href=\"/\"><span data-i18n=\"رجوع\">رجوع</span></a></div><div class=\"actions\" id=\"optionCount\"><button class=\"secondary\" id=\"twoOptions\"><span data-i18n=\"خيارين\">خيارين</span></button><button class=\"secondary\" id=\"threeOptions\"><span data-i18n=\"٣ اختيارات\">٣ اختيارات</span></button></div><p class=\"muted\"><span data-i18n=\"كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.\">كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.</span></p></section>\n<section class=\"hidden\" id=\"trainer\"><div class=\"status\" id=\"connection\" role=\"status\"><span class=\"dot\"></span><span data-i18n=\"جاري الاتصال…\">جاري الاتصال…</span></div><div aria-live=\"off\" class=\"countdown hidden\" id=\"trainerCountdown\" role=\"timer\"><span class=\"countdown-label\"></span><strong class=\"countdown-value\" dir=\"ltr\"></strong><p class=\"countdown-note hidden\"></p></div><h2 dir=\"auto\" id=\"trainerTitle\"></h2><div class=\"invite\"><div><span class=\"eyebrow\"><span data-i18n=\"كود دخول المتدربين\">كود دخول المتدربين</span></span><div class=\"code\" id=\"sessionCode\"></div><p class=\"muted\"><span data-i18n=\"امسح الـ QR أو افتح الرابط واكتب الكود.\">امسح الـ QR أو افتح الرابط واكتب الكود.</span></p><div class=\"actions\"><button class=\"secondary\" id=\"copyJoin\"><span data-i18n=\"انسخ رابط المتدربين\">انسخ رابط المتدربين</span></button><a class=\"btn secondary\" id=\"openJoin\" rel=\"noopener\" target=\"_blank\"><span data-i18n=\"افتح كمتدرب\">افتح كمتدرب</span></a></div><a class=\"url\" id=\"joinUrl\" rel=\"noopener\" target=\"_blank\"></a></div><figure class=\"qrbox\"><a id=\"qrLink\" rel=\"noopener\" target=\"_blank\"><img alt=\"QR لدخول السيشن على جهاز المتدرب\" data-i18n-alt=\"QR لدخول السيشن على جهاز المتدرب\" height=\"208\" id=\"qr\" width=\"208\"/></a><figcaption><span data-i18n=\"امسح الرمز بالموبايل للمشاركة\">امسح الرمز بالموبايل للمشاركة</span></figcaption></figure></div><section class=\"card\"><span class=\"eyebrow\" id=\"pollStatus\"></span><h2 dir=\"auto\" id=\"resultQuestion\"></h2><div class=\"metric\"><strong id=\"total\">0</strong><span><span data-i18n=\"ردود حقيقية\">ردود حقيقية</span></span></div><p class=\"muted\" id=\"empty\"><span data-i18n=\"لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.\">لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.</span></p><div class=\"results\" id=\"results\"></div><section class=\"hidden\" id=\"rankingResults\"><h3><span data-i18n=\"ترتيب السؤال\">ترتيب السؤال</span></h3><p class=\"muted\" id=\"rankingHint\"></p><div id=\"rankingList\"></div><p class=\"muted\"><span data-i18n=\"وقت الوصول للسيرفر من فتح السؤال\">وقت الوصول للسيرفر من فتح السؤال</span></p><div class=\"actions\"><button class=\"secondary\" id=\"nextRanking\"><span data-i18n=\"السؤال التالي في نفس الجولة\">السؤال التالي في نفس الجولة</span></button><button id=\"finishRanking\"><span data-i18n=\"إنهاء الجولة وعرض السكور\">إنهاء الجولة وعرض السكور</span></button></div><section class=\"hidden card\" id=\"roundResults\"><h3><span data-i18n=\"السكور النهائي للجولة\">السكور النهائي للجولة</span></h3><div id=\"roundList\"></div></section></section><section class=\"card hidden\" id=\"namedPollSection\"><h3><span data-i18n=\"مين اختار إيه؟\">مين اختار إيه؟</span></h3><div class=\"results\" id=\"namedPollAnswers\"></div></section><div class=\"actions\"><button class=\"secondary\" id=\"toggle\"><span data-i18n=\"اقفل التصويت\">اقفل التصويت</span></button><button class=\"secondary\" id=\"newSession\"><span data-i18n=\"سيشن جديد\">سيشن جديد</span></button></div><div class=\"notice hidden\" id=\"newConfirm\"><p><span data-i18n=\"هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.\">هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.</span></p><div class=\"actions\"><button id=\"confirmNew\"><span data-i18n=\"اقفل وابدأ جديد\">اقفل وابدأ جديد</span></button><button class=\"secondary\" id=\"cancelNew\"><span data-i18n=\"إلغاء\">إلغاء</span></button></div></div><div class=\"notice\" data-normal-only=\"true\"><strong><span data-i18n=\"حوّل التصويت لنقاش\">حوّل التصويت لنقاش</span></strong><p><span data-i18n=\"إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.\">إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.</span></p></div><p class=\"muted\"><span data-i18n=\"تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.\">تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.</span></p></section></section>\n<section class=\"hidden\" id=\"quiz\"><div id=\"quizRoot\"></div></section>\n<section class=\"hidden\" id=\"quizPlay\"><div id=\"quizPlayRoot\"></div></section>\n<section class=\"hidden\" id=\"join\"><span class=\"eyebrow\"><span data-i18n=\"شارك في النشاط\">شارك في النشاط</span></span><h2><span data-i18n=\"جاهز تشارك؟\">جاهز تشارك؟</span></h2><p><span data-i18n=\"اكتب الكود الظاهر في شاشة المدرب.\">اكتب الكود الظاهر في شاشة المدرب.</span></p><label for=\"joinCode\"><span data-i18n=\"كود السيشن\">كود السيشن</span></label><input autocomplete=\"off\" class=\"joincode\" id=\"joinCode\" inputmode=\"numeric\" maxlength=\"6\" placeholder=\"000000\"/><div class=\"actions\"><button id=\"joinButton\"><span data-i18n=\"ادخل النشاط\">ادخل النشاط</span></button></div></section>\n<section class=\"hidden\" id=\"participant\"><div class=\"status\" id=\"participantConnection\" role=\"status\"></div><div aria-live=\"off\" class=\"countdown hidden\" id=\"participantCountdown\" role=\"timer\"><span class=\"countdown-label\"></span><strong class=\"countdown-value\" dir=\"ltr\"></strong><p class=\"countdown-note hidden\"></p></div><span class=\"eyebrow\" id=\"answerType\"><span data-i18n=\"تصويت سريع · اختيار واحد\">تصويت سريع · اختيار واحد</span></span><div class=\"notice hidden\" id=\"rankingParticipantInfo\"><p><span data-i18n=\"ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.\">ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.</span></p><p id=\"rankingParticipantRule\"></p></div><h2 dir=\"auto\" id=\"participantTitle\"></h2><h3 dir=\"auto\" id=\"participantQuestion\"></h3><div class=\"notice hidden\" id=\"nameEntry\"><label for=\"participantName\"><span data-i18n=\"اسمك اللي هيظهر للمدرب\">اسمك اللي هيظهر للمدرب</span></label><input autocomplete=\"off\" data-i18n-placeholder=\"اكتب اسمك\" dir=\"auto\" id=\"participantName\" maxlength=\"200\" placeholder=\"اكتب اسمك\"/><p><span data-i18n=\"السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.\">السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.</span></p></div><div class=\"choices\" id=\"choices\"></div><div class=\"hidden\" id=\"textEntry\"><label for=\"writtenAnswer\"><span data-i18n=\"إجابتك\">إجابتك</span></label><textarea data-i18n-placeholder=\"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\" dir=\"auto\" id=\"writtenAnswer\" maxlength=\"500\" placeholder=\"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\"></textarea><div class=\"muted\"><span id=\"charCount\">0</span><span data-i18n=\" / 500 حرف\"> / 500 حرف</span></div><div class=\"notice\"><span id=\"textPrivacy\"><span data-i18n=\"ردك من غير اسم، وبيوصل للمدرب فقط.\">ردك من غير اسم، وبيوصل للمدرب فقط.</span></span><span data-i18n=\" ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.\"> ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.</span></div></div><div class=\"notice hidden\" id=\"voteStatus\" role=\"status\"></div><div class=\"actions\"><button disabled=\"\" id=\"vote\"><span data-i18n=\"ثبّت إجابتي\">ثبّت إجابتي</span></button><a class=\"btn secondary\" href=\"/join\"><span data-i18n=\"ادخل سيشن تاني\">ادخل سيشن تاني</span></a></div><p class=\"muted\" data-normal-only=\"true\"><span data-i18n=\"إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.\">إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.</span></p></section>\n<section class=\"hidden\" id=\"wheel\"><h2><span data-i18n=\"لف واختار\">لف واختار</span></h2><p><span data-i18n=\"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\">اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.</span></p><div class=\"wheel-layout\"><div class=\"wheel-editor\"><label for=\"wheelEntries\"><span data-i18n=\"العناصر\">العناصر</span></label><p class=\"muted\"><span data-i18n=\"كل اسم أو رقم أو عنصر في سطر منفصل.\">كل اسم أو رقم أو عنصر في سطر منفصل.</span></p><textarea data-i18n-placeholder=\"أسماء، أرقام، أفكار… كل عنصر في سطر\" dir=\"auto\" id=\"wheelEntries\" maxlength=\"25000\" placeholder=\"أسماء، أرقام، أفكار… كل عنصر في سطر\" rows=\"10\" spellcheck=\"false\"></textarea><p class=\"muted\" id=\"wheelCount\"></p><button class=\"secondary\" id=\"wheelClear\" type=\"button\"><span data-i18n=\"مسح العناصر\">مسح العناصر</span></button></div><div class=\"wheel-stage\"><canvas aria-label=\"عجلة اختيار عشوائي\" height=\"720\" id=\"wheelCanvas\" role=\"img\" width=\"720\"></canvas><button disabled=\"\" id=\"wheelSpin\" type=\"button\"><span data-i18n=\"لف العجلة\">لف العجلة</span></button><section aria-atomic=\"true\" aria-live=\"polite\" class=\"wheel-result hidden\" id=\"wheelResult\"><p><span data-i18n=\"الاختيار وقع على\">الاختيار وقع على</span></p><strong dir=\"auto\" id=\"wheelWinner\"></strong></section></div></div><div class=\"notice\"><p><span data-i18n=\"كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.\">كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.</span></p><p><span data-i18n=\"من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.\">من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.</span></p><p><span data-i18n=\"العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.\">العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.</span></p><p><span data-i18n=\"اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.\">اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.</span></p></div></section><footer><span data-i18n=\"نسخة أولية مجانية · تحتاج اتصالاً بالإنترنت · من غير ردود محاكاة · الردود والأسئلة محفوظة مؤقتاً على Cloudflare\">نسخة أولية مجانية · تحتاج اتصالاً بالإنترنت · من غير ردود محاكاة · الردود والأسئلة محفوظة مؤقتاً على Cloudflare</span></footer></main><script>\nconst EN={\"نشاط سريع · ردود حقيقية من كل جهاز\": \"Quick activity · Real replies from every device\", \"البداية\": \"Home\", \"سؤال واحد، كود واحد، ونقاش يشارك فيه الكل. بالاسم أو من غيره، ومن غير تسجيل حساب.\": \"One question. One code. Everyone joins the conversation. Named or anonymous, with no account needed.\", \"للمدرب\": \"FOR TRAINERS\", \"اسمع رأي القاعة\": \"Hear from everyone\", \"اكتب سؤالك، اعرض الـ QR، وشوف الردود بتوصل من أجهزة المتدربين.\": \"Write a question, share the QR code and watch replies arrive from participants' devices.\", \"جهّز سؤال\": \"Prepare a question\", \"للمتدرب\": \"FOR PARTICIPANTS\", \"جاهز تشارك؟\": \"Ready to join?\", \"معاك كود من المدرب؟ ادخل النشاط واختار إجابتك.\": \"Have a code from your trainer? Join the activity and share your answer.\", \"ادخل بكود السيشن\": \"Join with a session code\", \"للمدرب · القسم الثالث\": \"FOR TRAINERS · QUESTION BANK\", \"بنك أسئلة جاهزة\": \"A question to get things going\", \"٥٠ سؤال خفيف في ٥ أقسام. اختار سؤال وعدّله براحتك قبل ما تبدأ.\": \"50 light-hearted questions in 5 categories. Pick one and make it your own before you start.\", \"اختار من بنك الأسئلة\": \"Browse the question bank\", \"عندك سيشن مفتوح على المتصفح ده.\": \"You have a session saved in this browser tab.\", \"ارجع لشاشة المدرب\": \"Return to trainer view\", \"نسخة أولية لايف\": \"Live pilot\", \"تحتاج إنترنت على كل جهاز. التحديث كل ٥ ثوانٍ. استخدم أسئلة تجريبية فقط، من غير بيانات عملاء أو معلومات حساسة.\": \"Every device needs internet. Updates arrive every 5 seconds. Use test questions only, without customer data or sensitive information.\", \"من غير ما تنقل محتواك\": \"NO NEED TO REBUILD YOUR TRAINING\", \"جهّز سؤال واحد\": \"Prepare one question\", \"اختار من بنك الأسئلة · ٥٠ سؤال\": \"Browse the question bank · 50 questions\", \"اختيار السؤال بيملأ الحقول بس، مش بيبدأ السيشن. راجع وعدّل قبل النشر.\": \"Picking a question only fills the fields. It does not start a session. Review and edit before going live.\", \"هوية المشاركين\": \"Participant identity\", \"من غير أسماء\": \"Anonymous\", \"بالأسماء\": \"Named\", \"هتشوف الردود من غير أسماء، زي الوضع الحالي.\": \"Replies will appear without participant names.\", \"نوع الإجابة\": \"Answer type\", \"اختيارات\": \"Multiple choice\", \"إجابة مكتوبة\": \"Written answer\", \"المتدرب يختار إجابة واحدة من ٣ اختيارات.\": \"Participants select one of three options.\", \"عنوان السيشن\": \"Session title\", \"سؤال النقاش\": \"Discussion question\", \"الاختيار ١\": \"Option 1\", \"الاختيار ٢\": \"Option 2\", \"الاختيار ٣\": \"Option 3\", \"افتح السيشن اللايف\": \"Start live session\", \"رجوع\": \"Back\", \"خيارين\": \"Two options\", \"٣ اختيارات\": \"Three options\", \"كل سيشن سؤال واحد، باختيارات أو إجابة مكتوبة، وصلاحيته ٢٤ ساعة. مش اختبار معتمد ولا تقييم جاهزية للعمل.\": \"Each session has one question, with multiple-choice or written answers, and lasts 24 hours. This is not a certified exam or a work-readiness assessment.\", \"جاري الاتصال…\": \"Connecting…\", \"كود دخول المتدربين\": \"PARTICIPANT JOIN CODE\", \"امسح الـ QR أو افتح الرابط واكتب الكود.\": \"Scan the QR code, or open the link and enter the code.\", \"انسخ رابط المتدربين\": \"Copy participant link\", \"افتح كمتدرب\": \"Open participant view\", \"امسح الرمز بالموبايل للمشاركة\": \"Scan with your phone to join\", \"ردود حقيقية\": \"Real replies\", \"لسه مفيش ردود. اعرض الكود أو الـ QR للقاعة.\": \"No replies yet. Share the code or QR with the room.\", \"مين اختار إيه؟\": \"Who chose what?\", \"اقفل التصويت\": \"Close voting\", \"سيشن جديد\": \"New session\", \"هتقفل التصويت الحالي وتبدأ سؤال جديد. النتايج الحالية هتفضل متاحة لحد انتهاء السيشن.\": \"This closes the current session to replies and prepares a new question. Current results stay available until the session expires.\", \"اقفل وابدأ جديد\": \"Close and start new\", \"إلغاء\": \"Cancel\", \"حوّل التصويت لنقاش\": \"Turn replies into a discussion\", \"إيه اللي يخليك تختار الرد ده؟ وإيه المعلومة الناقصة قبل ما ترد على العميل؟ مفيش تصحيح آلي أو ترتيب للمتدربين.\": \"What made you choose that answer? What else would you want to know? There is no automatic marking or participant ranking.\", \"تحديث الصفحة آمن، لكن قفل التبويب أو تغيير المتصفح ممكن يضيّع صلاحية التحكم. رابط المتدربين ما بيدّيش صلاحية التحكم. بيانات السيشن بتصبح غير متاحة بعد ٢٤ ساعة وتُحذف عند التنظيف التالي.\": \"Refreshing this tab is safe. Closing the tab or switching browsers may lose trainer control. Participant links do not grant control. Sessions become unavailable after 24 hours and are deleted during the next cleanup.\", \"شارك في النشاط\": \"JOIN THE ACTIVITY\", \"اكتب الكود الظاهر في شاشة المدرب.\": \"Enter the code shown on your trainer's screen.\", \"كود السيشن\": \"Session code\", \"ادخل النشاط\": \"Join activity\", \"تصويت سريع · اختيار واحد\": \"QUICK POLL · CHOOSE ONE\", \"اسمك اللي هيظهر للمدرب\": \"Your display name for the trainer\", \"السيشن دي بالأسماء. اسمك وإجابتك هيظهروا للمدرب، وممكن يعرض شاشته للقاعة. اكتب الاسم اللي تحب تظهر بيه فقط، من غير أي بيانات إضافية.\": \"This is a named session. The trainer sees your name and answer and may project the results. Enter only the name or nickname you want displayed, without any other personal details.\", \"إجابتك\": \"Your answer\", \" / 500 حرف\": \" / 500 characters\", \"ردك من غير اسم، وبيوصل للمدرب فقط.\": \"Your reply is anonymous and is sent only to the trainer.\", \" ممكن المدرب يعرض شاشته للقاعة، فما تكتبش أي بيانات شخصية أو بيانات عملاء.\": \" The trainer may project the screen. Do not include personal information or customer data.\", \"ثبّت إجابتي\": \"Submit my answer\", \"ادخل سيشن تاني\": \"Join another session\", \"إجابة واحدة لكل متصفح في السيشن. دي وسيلة للنقاش مش نظام امتحانات، وممكن التصويت من متصفح تاني. ما تكتبش أي بيانات شخصية.\": \"One reply per browser in each session. This is a discussion tool, not an exam system. Another browser can submit again. Do not include personal information.\", \"نسخة أولية مجانية · تحتاج اتصالاً بالإنترنت · من غير ردود محاكاة · الردود والأسئلة محفوظة مؤقتاً على Cloudflare\": \"Free pilot · Internet required · No simulated replies · Questions and replies are stored temporarily on Cloudflare\", \"أقسام بنك الأسئلة\": \"Question bank categories\", \"QR لدخول السيشن على جهاز المتدرب\": \"Scan this QR code to join on a participant device\", \"اكتب اسمك\": \"Enter your name or nickname\", \"اكتب فكرتك هنا، من غير أسماء أو بيانات شخصية…\": \"Share your thoughts, without names or personal information…\", \"التعامل مع عميل غاضب\": \"Handling an upset customer\", \"عميل متضايق لأن طلبه اتأخر. تبدأ بإيه؟\": \"A customer is upset about a delayed order. How do you start?\", \"أشرح سياسة الشركة فوراً\": \"Explain company policy right away\", \"أسمع المشكلة وأتأكد إني فاهمها\": \"Listen and check that I understand the problem\", \"أحوّله لقسم تاني من غير توضيح\": \"Transfer them without explaining\", \"حصل خطأ. جرّب تاني.\": \"Something went wrong. Please try again.\", \"تعذّر الاتصال بالخدمة. اتأكد من الإنترنت وجرّب تاني.\": \"Could not connect. Check your internet and try again.\", \"تعذّر تنفيذ الطلب.\": \"Could not complete the request.\", \"كل مشارك هيكتب اسمه، وهتشوف اسمه جنب إجابته. قول للقاعة قبل المشاركة.\": \"Each participant enters a name, shown beside their answer. Tell the room before they join.\", \"المتدرب يختار إجابة واحدة من خيارين.\": \"Participants select one of two options.\", \"المتدرب يكتب رد واحد لحد ٥٠٠ حرف. ظهور الاسم حسب وضع الهوية اللي اخترته فوق.\": \"Participants write one reply of up to 500 characters. Names follow the identity mode selected above.\", \" · ١٠ أسئلة\": \" · 10 questions\", \"مكتوبة\": \"Written\", \"اتختار السؤال \": \"Selected question \", \". راجع الحقول وعدّل قبل ما تبدأ.\": \". Review and edit the fields before you start.\", \"كمّل عنوان السيشن والسؤال وكل الاختيارات.\": \"Complete the session title, question and all options.\", \"استقبال الردود مفتوح\": \"Replies are open\", \"التصويت مفتوح\": \"Voting is open\", \"استقبال الردود مقفول\": \"Replies are closed\", \"التصويت مقفول\": \"Voting is closed\", \"اقفل الردود\": \"Close replies\", \"افتح الردود\": \"Open replies\", \"افتح التصويت\": \"Open voting\", \"مشارك\": \"Participant\", \"رد \": \"Reply \", \"متصل · آخر تحديث \": \"Connected · Last updated \", \"التحديث متوقف مؤقتاً، بنحاول تاني\": \"Updates paused. Retrying…\", \"اتنسخ الرابط\": \"Link copied\", \"انسخ الرابط المكتوب تحت الزر\": \"Copy the link below this button\", \"اكتب كود السيشن المكوّن من ٦ أرقام.\": \"Enter the 6-digit session code.\", \"ردك واسمك بيوصلوا للمدرب فقط.\": \"Your name and reply are sent only to the trainer.\", \"سؤال مفتوح · إجابة مكتوبة\": \"OPEN QUESTION · WRITTEN ANSWER\", \"ابعث إجابتي\": \"Send my answer\", \"اتسجّل ردك ووصل للمدرب. شكراً لمشاركتك.\": \"Your reply reached the trainer. Thanks for taking part.\", \"المدرب قفل استقبال الردود. لو فتحه تاني هتقدر تشارك.\": \"The trainer has closed replies. You can join in if they reopen them.\", \"متصل · استقبال الردود مفتوح\": \"Connected · Replies are open\", \"متصل · استقبال الردود مقفول\": \"Connected · Replies are closed\", \"تعذّر تحديث حالة السيشن\": \"Could not update the session status\", \"حجم الطلب أكبر من المسموح.\": \"The request is too large.\", \"بيانات الطلب غير صحيحة.\": \"The request data is invalid.\", \"كمّل السؤال والاختيارات، والتزم بالطول المسموح.\": \"Complete the question and options within the length limits.\", \"كود غير صحيح.\": \"Invalid code.\", \"الخدمة قيد التجهيز. جرّب بعد قليل.\": \"The service is getting ready. Try again shortly.\", \"مطلوب خيارين أو ٣ اختيارات.\": \"Provide two or three options.\", \"وصلنا للحد التجريبي اليومي. جرّب لاحقاً.\": \"The pilot session limit has been reached. Try again later.\", \"تعذّر إنشاء كود جديد. جرّب تاني.\": \"Could not create a new code. Please try again.\", \"الرابط مش موجود.\": \"This link does not exist.\", \"مفيش سيشن بالكود ده. اتأكد من الكود.\": \"No session was found. Check the code.\", \"الكود غير صحيح أو السيشن انتهى. اتأكد من المدرب.\": \"The code is invalid or the session has expired. Check with the trainer.\", \"بيانات المتصفح غير صحيحة.\": \"Invalid browser data.\", \"اكتب الاسم اللي تحب تظهر بيه، لحد ٢٠٠ حرف.\": \"Enter a display name, up to 200 characters.\", \"المدرب قفل استقبال الردود.\": \"The trainer has closed replies.\", \"المدرب قفل الردود.\": \"The trainer has closed replies.\", \"استقبال الردود مقفول أو وصل للحد التجريبي.\": \"Replies are closed or the pilot reply limit has been reached.\", \"اختار إجابة صحيحة.\": \"Choose a valid option.\", \"المدرب قفل التصويت.\": \"The trainer has closed voting.\", \"التصويت مقفول أو وصل للحد التجريبي.\": \"Voting is closed or the pilot reply limit has been reached.\", \"شاشة المدرب دي مش متاحة من المتصفح الحالي.\": \"Trainer access is not available in this browser tab.\", \"حالة التصويت غير صحيحة.\": \"Invalid voting status.\", \"الطلب غير مسموح.\": \"This request is not allowed.\", \"تعذّر الاتصال بالخدمة. جرّب تاني بعد قليل.\": \"Could not connect to the service. Try again shortly.\", \"مؤقت السؤال\": \"Question timer\", \"من غير مؤقت\": \"No timer\", \"بمؤقت\": \"Timed\", \"المدة\": \"Duration\", \"دقائق\": \"Minutes\", \"ثواني\": \"Seconds\", \"المؤقت اختياري. بيبدأ لما تفتح السيشن، وبيقفل استقبال الردود تلقائياً عند الصفر.\": \"The timer is optional. It starts when you open the live session and closes replies automatically at zero.\", \"قفل وفتح الردود مش بيوقف أو يعيد المؤقت. بعد الصفر ابدأ سيشن جديد لو عايز تكمل.\": \"Closing and reopening replies does not pause or reset the timer. After zero, start a new session to continue.\", \"الوقت المتبقي\": \"Time remaining\", \"الوقت خلص\": \"Time is up\", \"الوقت خلص. استقبال الردود اتقفل تلقائياً.\": \"Time is up. Replies closed automatically.\", \"الوقت خلص. ابدأ سيشن جديد لو عايز تكمل.\": \"Time is up. Start a new session to continue.\", \"اختار مدة صحيحة من ثانية لحد ٢٣ ساعة و٥٩ دقيقة و٥٩ ثانية، أو اقفل المؤقت.\": \"Choose a duration from 1 second to 23 hours, 59 minutes and 59 seconds, or turn the timer off.\", \"اكتب الدقائق من ٠ لحد ١٤٣٩ والثواني من ٠ لحد ٥٩. المدة لازم تكون ثانية على الأقل.\": \"Enter 0–1439 minutes and 0–59 seconds, with a total duration of at least 1 second.\", \"الوضع الداكن\": \"Dark mode\", \"الوضع الفاتح\": \"Light mode\", \"تغيير المظهر\": \"Change appearance\"};\nObject.assign(EN,{\"اكتب عنوان السيشن\": \"Enter a session title\", \"اكتب سؤالك هنا\": \"Write your question here\", \"اكتب الاختيار الأول\": \"Enter the first option\", \"اكتب الاختيار الثاني\": \"Enter the second option\", \"اكتب الاختيار الثالث\": \"Enter the third option\"});\nObject.assign(EN,{\"رانكينج\": \"Ranking\", \"إعدادات الرانكينج\": \"Ranking settings\", \"في إجابة صح؟\": \"Does this question have a correct answer?\", \"من غير إجابة صح\": \"No correct answer\", \"في إجابة صح\": \"Has a correct answer\", \"اختار الإجابة الصحيحة\": \"Choose the correct option\", \"الاختيار الأول\": \"First option\", \"الاختيار الثاني\": \"Second option\", \"الاختيار الثالث\": \"Third option\", \"الرانكينج باختيارات. الأسرع حسب وقت وصول الرد للسيرفر من فتح السؤال، فسرعة الإنترنت بتأثر. مع الإجابة الصحيحة، الردود الصح بس تدخل الترتيب.\": \"Ranking uses selectable options. Speed is measured from question opening to server receipt, so network speed affects the result. With a correct option, only correct answers are ranked.\", \"النقاط لكل سؤال: ١٠٠٠ ÷ المركز، مقربة لأسفل وبحد أدنى نقطة. التعادل في الوقت ياخد نفس المركز والنقاط.\": \"Points per question: 1000 ÷ place, rounded down, minimum 1 point. Equal times share a place and points.\", \"ترتيب السؤال\": \"Question ranking\", \"اقفل الردود أو استنى المؤقت يخلص عشان يظهر ترتيب السؤال.\": \"Close replies or wait for the timer to see the question ranking.\", \"مفيش إجابات مؤهلة للترتيب لسه.\": \"No eligible answers to rank.\", \"السكور النهائي للجولة\": \"Final round scores\", \"السؤال التالي في نفس الجولة\": \"Next question in this round\", \"إنهاء الجولة وعرض السكور\": \"End round and show scores\", \"إنهاء الجولة يقفل كل أسئلتها نهائياً. متأكد؟\": \"Ending the round permanently closes all its questions. Continue?\", \"نقطة\": \"points\", \"ثانية\": \"seconds\", \"مشارك \": \"Participant \", \"إجابات مؤهلة\": \"eligible answers\", \"جولة رانكينج مستمرة. خلي المشاركين يدخلوا كل سؤال من نفس المتصفح عشان السكور يتجمع. لكل سؤال كود وQR جديد.\": \"Continuing a ranking round. Participants must use the same browser for every question to combine scores. Each question has a new code and QR.\", \"ابدأ جولة منفصلة بدل دي\": \"Start a separate round instead\", \"رانكينج · أسرع إجابة\": \"Ranking · Fastest answer\", \"رانكينج · أسرع إجابة صحيحة\": \"Ranking · Fastest correct answer\", \"ترتيبك بيظهر للمدرب بعد قفل السؤال. استخدم نفس المتصفح طول الجولة.\": \"The trainer sees rankings after the question closes. Use the same browser throughout the round.\", \"الجولة انتهت. ابدأ جولة جديدة.\": \"This round has ended. Start a new round.\", \"اختار الإجابة الصحيحة من الاختيارات.\": \"Choose a correct option from the available options.\", \"خلي وضع الأسماء ثابت في نفس الجولة.\": \"Keep the same name setting for this round.\", \"الجولة وصلت ٥٠ سؤال. ابدأ جولة جديدة.\": \"This round has reached 50 questions. Start a new round.\", \"الجولة دي مش متاحة من المتصفح الحالي.\": \"This round is not available in this browser.\", \"جولة غير صحيحة.\": \"Invalid round.\", \"كل سؤال ليه كود جديد. استخدموا نفس المتصفح لكل الأسئلة. النتايج مؤقتة لمدة ٢٤ ساعة، زي باقي الأوضاع.\": \"Each question has a new code. Use the same browser for every question. Results are temporary for 24 hours, like the other modes.\", \"جولة جديدة\": \"New round\", \"المركز\": \"Place\", \"المشارك\": \"Participant\", \"الوقت\": \"Time\", \"النقاط\": \"Points\", \"وقت الوصول للسيرفر من فتح السؤال\": \"Server receipt time from question opening\", \"الهوية في الجولة\": \"Identity in this round\", \"الإجابات غير الصحيحة لا تأخذ نقاط.\": \"Incorrect answers receive no points.\", \"الجولة خلصت. السكور النهائي ظاهر تحت.\": \"Round ended. Final scores are shown below.\"});\nObject.assign(EN,{\"العجلة\": \"Wheel\", \"الأنشطة\": \"Activities\", \"لف واختار\": \"Spin and pick\", \"اختار عشوائياً من أسماء أو أرقام أو أي عناصر تكتبها بنفسك.\": \"Pick randomly from names, numbers or any entries you write.\", \"العناصر\": \"Entries\", \"كل اسم أو رقم أو عنصر في سطر منفصل.\": \"One name, number or entry per line.\", \"أسماء، أرقام، أفكار… كل عنصر في سطر\": \"Names, numbers, ideas… one entry per line\", \"لف العجلة\": \"Spin the wheel\", \"بتلف…\": \"Spinning…\", \"مسح العناصر\": \"Clear entries\", \"تمسح كل عناصر العجلة؟\": \"Clear every wheel entry?\", \"الاختيار وقع على\": \"The wheel picked\", \"عنصر\": \"entries\", \"أضف العناصر\": \"Add entries\", \"عجلة اختيار عشوائي\": \"Random picker wheel\", \"اكتب عنصرين على الأقل، كل عنصر في سطر.\": \"Enter at least two entries, one per line.\", \"الحد الأقصى ٢٠٠ عنصر في اللفة.\": \"A spin supports up to 200 entries.\", \"كل عنصر لحد ١٠٠ حرف.\": \"Each entry can have up to 100 characters.\", \"كل سطر له نفس فرصة الاختيار. تكرار نفس العنصر يزود فرصته. الفائز يفضل موجود للفة اللي بعدها.\": \"Each line has an equal chance. Repeated entries increase their chance. The winner stays in the list for the next spin.\", \"من ٢ إلى ٢٠٠ عنصر، وكل عنصر لحد ١٠٠ حرف. مع القوائم الكبيرة تظهر الألوان على العجلة والنتيجة كاملة تحتها.\": \"Use 2 to 200 entries, up to 100 characters each. Large lists show colored segments and the full result below.\", \"العناصر موجودة في الصفحة دي فقط، مش بتتبعت للسيرفر ومش بتتحفظ بعد الريفريش.\": \"Entries stay on this page only. They are not sent to the server and are not kept after a refresh.\", \"اختيار عشوائي للأنشطة والجوائز البسيطة، مش سحب معتمد أو لعبة بفلوس.\": \"Random picking for activities and small prizes, not a certified draw or a money game.\"});\nlet lang='ar';try{lang=new URLSearchParams(location.search).get('lang')||localStorage.getItem('roompulse.language')||'ar'}catch{}if(!['ar','en'].includes(lang))lang='ar';\nconst t=s=>lang==='en'?(EN[s]??s):s;\nfunction localBank(x){return lang==='en'?{...x,...x.en}:x}\nfunction applyLanguage(){applyTheme();renderWheelLanguage();document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));for(const a of ['placeholder','alt','aria-label'])document.querySelectorAll('[data-i18n-'+a+']').forEach(e=>e.setAttribute(a,t(e.getAttribute('data-i18n-'+a))));document.querySelectorAll('[data-default-ar]').forEach(e=>{if([e.dataset.defaultAr,e.dataset.defaultEn].includes(e.value))e.value=lang==='en'?e.dataset.defaultEn:e.dataset.defaultAr});$('langAR').setAttribute('aria-pressed',String(lang==='ar'));$('langEN').setAttribute('aria-pressed',String(lang==='en'));document.querySelectorAll('a').forEach(e=>{if(!e.dataset.route&&['/','/join'].includes(e.getAttribute('href')))e.dataset.route=e.getAttribute('href');if(e.dataset.route)e.href=(e.dataset.route==='/join'?joinPath:appBase)+'?lang='+lang});moveSectionPill()}\nfunction setLanguage(v){lang=v;try{localStorage.setItem('roompulse.language',v)}catch{}const u=new URL(location);u.searchParams.set('lang',lang);history.replaceState(null,'',u);applyLanguage();renderBank();setIdentity(identity);setMode(mode);updateCountdown();$('copyJoin').textContent=t('انسخ رابط المتدربين');if($('bankSelected').dataset.questionId)$('bankSelected').textContent=t('اتختار السؤال ')+$('bankSelected').dataset.questionId+t('. راجع الحقول وعدّل قبل ما تبدأ.');if(lastError)$('globalError').textContent=t(lastError);if(role==='participant'&&current)renderParticipant();if(role==='trainer'&&current){renderRanking(current);const u=location.origin+joinPath+'?code='+current.code+'&lang='+lang;for(const id of ['joinUrl','openJoin','qrLink'])$(id).href=u;$('joinUrl').textContent=u;$('qr').src=apiOrigin+'/qr?code='+current.code+'&lang='+lang+(pagesHost?'&frontend=pages':'');refreshTrainer()}}\n\nlet lastError='';const $=id=>document.getElementById(id);let current=null,selected=-1,timer=null,role='',sending=false,mode='poll',optionCount=3,identity='anonymous';\nconst esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nfunction show(id){const previous=role;for(const n of ['welcome','setup','trainer','join','participant','wheel','quiz','quizPlay'])$(n).classList.toggle('hidden',n!==id);role=id;$('activitiesTab').setAttribute('aria-pressed',String(id!=='wheel'&&id!=='quiz'));$('wheelTab').setAttribute('aria-pressed',String(id==='wheel'));$('quizTab').setAttribute('aria-pressed',String(id==='quiz'));document.querySelector('.section-tabs').classList.toggle('hidden',id==='join'||id==='participant'||id==='quizPlay');updateCountdown();$('globalError').textContent='';lastError='';clearInterval(timer);timer=null;window.scrollTo(0,0);moveSectionPill();if(previous&&previous!==id&&!matchMedia('(prefers-reduced-motion: reduce)').matches){$(id).animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'})}}\nfunction error(e){lastError=Object.keys(EN).find(k=>EN[k]===e.message)||e.message;$('globalError').textContent=t(lastError)||t(\"حصل خطأ. جرّب تاني.\")}\nfunction saved(){try{return JSON.parse(sessionStorage.getItem('hall.trainer')||'null')}catch{return null}}\nfunction save(v){try{sessionStorage.setItem('hall.trainer',JSON.stringify(v))}catch{}}\nfunction client(){try{let v=localStorage.getItem('hall.device');if(!v){v=crypto.randomUUID();localStorage.setItem('hall.device',v)}return v}catch{return memoryClient}}\nconst memoryClient=crypto.randomUUID();\nconst pagesHost=location.origin==='https://omarnagycd.github.io';const apiOrigin=pagesHost?'https://roompulse.s21smk.workers.dev':'';const appBase=pagesHost?'/RoomPulse/':'/';const joinPath=pagesHost?appBase+'join/':'/join';\nasync function api(path,body,token){const r=await fetch(apiOrigin+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});let d;try{d=await r.json()}catch{throw new Error(t(\"تعذّر الاتصال بالخدمة. اتأكد من الإنترنت وجرّب تاني.\"))}if(d.serverNow)d.receivedAt=performance.now();if(!r.ok)throw new Error(d.error||t(\"تعذّر تنفيذ الطلب.\"));return d}\nfunction setIdentity(v){identity=v;$('identityAnonymous').setAttribute('aria-pressed',String(v==='anonymous'));$('identityNamed').setAttribute('aria-pressed',String(v==='named'));$('identityHint').textContent=v==='named'?t(\"كل مشارك هيكتب اسمه، وهتشوف اسمه جنب إجابته. قول للقاعة قبل المشاركة.\"):t(\"هتشوف الردود من غير أسماء، زي الوضع الحالي.\")} $('identityAnonymous').onclick=()=>setIdentity('anonymous');$('identityNamed').onclick=()=>setIdentity('named');$('participantName').oninput=()=>{try{sessionStorage.setItem('hall.name',$('participantName').value)}catch{}renderParticipant()};\nfunction setOptionCount(n){if($('correctChoice')){$('correctChoice').options[3].hidden=n===2;if(Number($('correctChoice').value)>=n)$('correctChoice').value='';}optionCount=n;$('thirdOption').classList.toggle('hidden',mode==='text'||n===2);$('twoOptions').setAttribute('aria-pressed',String(n===2));$('threeOptions').setAttribute('aria-pressed',String(n===3));if(mode==='poll')$('modeHint').textContent=n===2?t(\"المتدرب يختار إجابة واحدة من خيارين.\"):t(\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\")} $('twoOptions').onclick=()=>setOptionCount(2);$('threeOptions').onclick=()=>setOptionCount(3);\nfunction setMode(v){if(pendingRanking)v='ranking';mode=v;$('modeRanking').setAttribute('aria-pressed',String(v==='ranking'));$('rankingSetup').classList.toggle('hidden',v!=='ranking');$('modePoll').setAttribute('aria-pressed',String(v==='poll'));$('modeText').setAttribute('aria-pressed',String(v==='text'));for(const el of document.querySelectorAll('.option-field'))el.classList.toggle('hidden',v==='text');$('modeHint').textContent=v==='text'?t(\"المتدرب يكتب رد واحد لحد ٥٠٠ حرف. ظهور الاسم حسب وضع الهوية اللي اخترته فوق.\"):t(\"المتدرب يختار إجابة واحدة من ٣ اختيارات.\");$('optionCount').classList.toggle('hidden',v==='text');setOptionCount(optionCount);if(v==='ranking')$('modeHint').textContent=t('رانكينج · أسرع إجابة')} $('modeRanking').onclick=()=>setMode('ranking');$('modePoll').onclick=()=>setMode('poll');$('modeText').onclick=()=>setMode('text');$('writtenAnswer').oninput=()=>{$('charCount').textContent=$('writtenAnswer').value.length;$('vote').disabled=!$('writtenAnswer').value.trim()||(current?.identity==='named'&&!$('participantName').value.trim())||!current?.open||current?.voted||sending};\nconst bank=[{\"id\": 1, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أكلة تقدر تاكلها كل يوم من غير زهق؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What food could you eat every day without getting bored?\", \"options\": []}}, {\"id\": 2, \"category\": \"كسرة جليد سريعة\", \"question\": \"آخر صورة على موبايلك، إيه حكايتها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the story behind the last photo on your phone?\", \"options\": []}}, {\"id\": 3, \"category\": \"كسرة جليد سريعة\", \"question\": \"شاي ولا قهوة؟ ومحدش يزعل\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"Tea or coffee? No hard feelings!\", \"options\": []}}, {\"id\": 4, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أول حاجة بتعملها أول ما تصحى؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the first thing you do when you wake up?\", \"options\": []}}, {\"id\": 5, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه اسم فيلم ممكن تتفرج عليه ١٠ مرات؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What film could you watch ten times?\", \"options\": []}}, {\"id\": 6, \"category\": \"كسرة جليد سريعة\", \"question\": \"آخر أغنية سمعتها وعجبتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What was the last song you heard and liked?\", \"options\": []}}, {\"id\": 7, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أغرب حاجة في شنطتك دلوقتي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What is the strangest thing in your bag right now?\", \"options\": []}}, {\"id\": 8, \"category\": \"كسرة جليد سريعة\", \"question\": \"لو يومك ٢٥ ساعة، الساعة الزيادة تعمل فيها إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"If your day had 25 hours, what would you do with the extra hour?\", \"options\": []}}, {\"id\": 9, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه اسم أول موبايل كان عندك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What was your first mobile phone?\", \"options\": []}}, {\"id\": 10, \"category\": \"كسرة جليد سريعة\", \"question\": \"إيه أطرف كلمة مصرية بتحب تقولها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Quick icebreakers\", \"question\": \"What Egyptian expression do you find funniest?\", \"options\": []}}, {\"id\": 11, \"category\": \"لو كنت...\", \"question\": \"لو كنت شخصية كرتون، تكون مين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you were a cartoon character, who would you be?\", \"options\": []}}, {\"id\": 12, \"category\": \"لو كنت...\", \"question\": \"لو تقدر تسافر أي حتة بكرة، تروح فين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could travel anywhere tomorrow, where would you go?\", \"options\": []}}, {\"id\": 13, \"category\": \"لو كنت...\", \"question\": \"لو عندك قوة خارقة واحدة، تختار إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could have one superpower, what would it be?\", \"options\": []}}, {\"id\": 14, \"category\": \"لو كنت...\", \"question\": \"لو حياتك فيلم، مين يمثل دورك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your life were a film, who would play you?\", \"options\": []}}, {\"id\": 15, \"category\": \"لو كنت...\", \"question\": \"لو تقدر تقابل أي حد في العالم، مين؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could meet anyone in the world, who would it be?\", \"options\": []}}, {\"id\": 16, \"category\": \"لو كنت...\", \"question\": \"لو تشتغل أي شغلانة تانية خالص، تكون إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could do any completely different job, what would it be?\", \"options\": []}}, {\"id\": 17, \"category\": \"لو كنت...\", \"question\": \"لو فلوسك مش هتخلص أبداً، أول حاجة تشتريها؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your money could never run out, what would you buy first?\", \"options\": []}}, {\"id\": 18, \"category\": \"لو كنت...\", \"question\": \"لو ترجع بالزمن ١٠ سنين، هتقول لنفسك إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could go back ten years, what would you tell yourself?\", \"options\": []}}, {\"id\": 19, \"category\": \"لو كنت...\", \"question\": \"لو تعيش في أي عصر تاني، تختار أنهي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If you could live in another era, which would you choose?\", \"options\": []}}, {\"id\": 20, \"category\": \"لو كنت...\", \"question\": \"لو اسمك براند، هيبقى براند إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"What if...\", \"question\": \"If your name were a brand, what kind of brand would it be?\", \"options\": []}}, {\"id\": 21, \"category\": \"ده ولا ده\", \"question\": \"بحر ولا جبل؟\", \"mode\": \"poll\", \"options\": [\"بحر\", \"جبل\"], \"en\": {\"category\": \"This or that\", \"question\": \"Beach or mountains?\", \"options\": [\"Beach\", \"Mountains\"]}}, {\"id\": 22, \"category\": \"ده ولا ده\", \"question\": \"صيف ولا شتا؟\", \"mode\": \"poll\", \"options\": [\"صيف\", \"شتا\"], \"en\": {\"category\": \"This or that\", \"question\": \"Summer or winter?\", \"options\": [\"Summer\", \"Winter\"]}}, {\"id\": 23, \"category\": \"ده ولا ده\", \"question\": \"كشري ولا فول وطعمية؟\", \"mode\": \"poll\", \"options\": [\"كشري\", \"فول وطعمية\"], \"en\": {\"category\": \"This or that\", \"question\": \"Koshari or ful medames and falafel?\", \"options\": [\"Koshari\", \"Ful medames and falafel\"]}}, {\"id\": 24, \"category\": \"ده ولا ده\", \"question\": \"قطط ولا كلاب؟\", \"mode\": \"poll\", \"options\": [\"قطط\", \"كلاب\"], \"en\": {\"category\": \"This or that\", \"question\": \"Cats or dogs?\", \"options\": [\"Cats\", \"Dogs\"]}}, {\"id\": 25, \"category\": \"ده ولا ده\", \"question\": \"تسهر ولا تصحى بدري؟\", \"mode\": \"poll\", \"options\": [\"تسهر\", \"تصحى بدري\"], \"en\": {\"category\": \"This or that\", \"question\": \"Stay up late or wake up early?\", \"options\": [\"Stay up late\", \"Wake up early\"]}}, {\"id\": 26, \"category\": \"ده ولا ده\", \"question\": \"فطار ولا عشا؟\", \"mode\": \"poll\", \"options\": [\"فطار\", \"عشا\"], \"en\": {\"category\": \"This or that\", \"question\": \"Breakfast or dinner?\", \"options\": [\"Breakfast\", \"Dinner\"]}}, {\"id\": 27, \"category\": \"ده ولا ده\", \"question\": \"نتفليكس ولا سينما؟\", \"mode\": \"poll\", \"options\": [\"نتفليكس\", \"سينما\"], \"en\": {\"category\": \"This or that\", \"question\": \"Netflix or cinema?\", \"options\": [\"Netflix\", \"Cinema\"]}}, {\"id\": 28, \"category\": \"ده ولا ده\", \"question\": \"مدينة ولا قرية؟\", \"mode\": \"poll\", \"options\": [\"مدينة\", \"قرية\"], \"en\": {\"category\": \"This or that\", \"question\": \"City or village?\", \"options\": [\"City\", \"Village\"]}}, {\"id\": 29, \"category\": \"ده ولا ده\", \"question\": \"حلو ولا حادق؟\", \"mode\": \"poll\", \"options\": [\"حلو\", \"حادق\"], \"en\": {\"category\": \"This or that\", \"question\": \"Sweet or savoury?\", \"options\": [\"Sweet\", \"Savoury\"]}}, {\"id\": 30, \"category\": \"ده ولا ده\", \"question\": \"موبايل ولا لابتوب؟\", \"mode\": \"poll\", \"options\": [\"موبايل\", \"لابتوب\"], \"en\": {\"category\": \"This or that\", \"question\": \"Phone or laptop?\", \"options\": [\"Phone\", \"Laptop\"]}}, {\"id\": 31, \"category\": \"ضحك\", \"question\": \"إيه أغرب حاجة عملتها وانت صغير؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the strangest thing you did as a child?\", \"options\": []}}, {\"id\": 32, \"category\": \"ضحك\", \"question\": \"إيه أكتر كذبة صدقتها وانت طفل؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the biggest lie you believed as a child?\", \"options\": []}}, {\"id\": 33, \"category\": \"ضحك\", \"question\": \"إيه أسوأ هدية وصلتك في حياتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the worst gift you have ever received?\", \"options\": []}}, {\"id\": 34, \"category\": \"ضحك\", \"question\": \"إيه موقف محرج لسه فاكره لحد دلوقتي؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What embarrassing moment do you still remember?\", \"options\": []}}, {\"id\": 35, \"category\": \"ضحك\", \"question\": \"لو في مسابقة أكل، تكسب في أنهي أكلة؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What food would you win an eating contest with?\", \"options\": []}}, {\"id\": 36, \"category\": \"ضحك\", \"question\": \"إيه أطرف اسم دلع اتناديت بيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the funniest nickname you have ever had?\", \"options\": []}}, {\"id\": 37, \"category\": \"ضحك\", \"question\": \"لو حياتك مسلسل، هيبقى كوميدي ولا دراما؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"If your life were a TV series, would it be a comedy or a drama?\", \"options\": []}}, {\"id\": 38, \"category\": \"ضحك\", \"question\": \"إيه أكتر حاجة بتضحكك مهما كان مودك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What always makes you laugh, whatever your mood?\", \"options\": []}}, {\"id\": 39, \"category\": \"ضحك\", \"question\": \"إيه موقف \\\"أنا مش مصدق إني عملت كده\\\" وفخور بيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is something you cannot believe you did, but feel proud of?\", \"options\": []}}, {\"id\": 40, \"category\": \"ضحك\", \"question\": \"إيه أغرب مكان نمت فيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Laughs\", \"question\": \"What is the strangest place you have slept?\", \"options\": []}}, {\"id\": 41, \"category\": \"موودك\", \"question\": \"إيه الحاجة اللي بتشحن طاقتك؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What recharges your energy?\", \"options\": []}}, {\"id\": 42, \"category\": \"موودك\", \"question\": \"اكتب حاجة واحدة بتحبها في نفسك\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Write one thing you like about yourself.\", \"options\": []}}, {\"id\": 43, \"category\": \"موودك\", \"question\": \"إيه أحلى حاجة حصلتلك الأسبوع ده؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What is the nicest thing that happened to you this week?\", \"options\": []}}, {\"id\": 44, \"category\": \"موودك\", \"question\": \"لو مودك النهاردة طقس، يبقى إيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"If your mood today were weather, what would it be?\", \"options\": []}}, {\"id\": 45, \"category\": \"موودك\", \"question\": \"إيه أكلة نفسك فيها دلوقتي حالاً؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What food are you craving right now?\", \"options\": []}}, {\"id\": 46, \"category\": \"موودك\", \"question\": \"إيه الشغلانة اللي مستحيل تعملها أبداً؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What job would you never do?\", \"options\": []}}, {\"id\": 47, \"category\": \"موودك\", \"question\": \"اكتب إنجاز صغير فخور بيه الفترة دي\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Write a small achievement you feel proud of lately.\", \"options\": []}}, {\"id\": 48, \"category\": \"موودك\", \"question\": \"لو هتحتفل بأي حاجة النهاردة، هتحتفل بإيه؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"If you were celebrating something today, what would it be?\", \"options\": []}}, {\"id\": 49, \"category\": \"موودك\", \"question\": \"إيه نصيحة سمعتها وغيّرت فيك حاجة؟\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"What piece of advice has changed you?\", \"options\": []}}, {\"id\": 50, \"category\": \"موودك\", \"question\": \"كلمة واحدة توصف مودك دلوقتي\", \"mode\": \"text\", \"options\": [], \"en\": {\"category\": \"Your mood\", \"question\": \"Describe your mood right now in one word.\", \"options\": []}}];\nlet bankCategory=bank[0].category;\nfunction renderBank(){const cats=[...new Set(bank.map(x=>x.category))];$('bankTabs').innerHTML=cats.map(c=>'<button class=\"secondary\" data-category=\"'+esc(c)+'\" aria-pressed=\"'+(c===bankCategory)+'\">'+esc(lang==='en'?bank.find(x=>x.category===c).en.category:c)+'</button>').join('');$('bankCategory').textContent=(lang==='en'?bank.find(x=>x.category===bankCategory).en.category:bankCategory)+t(\" · ١٠ أسئلة\");$('bankList').innerHTML=bank.filter(x=>x.category===bankCategory).map(x=>'<button class=\"bank-pick\" data-bank=\"'+x.id+'\"><b>'+x.id+'</b><span>'+esc(localBank(x).question)+'</span><small>'+(x.mode==='poll'?t(\"خيارين\"):t(\"مكتوبة\"))+'</small></button>').join('');for(const el of document.querySelectorAll('[data-category]'))el.onclick=()=>{bankCategory=el.dataset.category;renderBank()};for(const el of document.querySelectorAll('[data-bank]'))el.onclick=()=>{const x=localBank(bank.find(q=>q.id===Number(el.dataset.bank)));$('title').value=x.category;$('question').value=x.question;setMode(x.mode);setOptionCount(x.mode==='poll'?x.options.length:3);for(let i=0;i<3;i++)$('option'+i).value=x.options[i]||'';$('bankSelected').dataset.questionId=x.id;$('bankSelected').textContent=t(\"اتختار السؤال \")+x.id+t(\". راجع الحقول وعدّل قبل ما تبدأ.\");$('bankPanel').open=false;$('question').focus()}}\n$('openBank').onclick=()=>{show('setup');$('bankPanel').open=true;$('bankPanel').scrollIntoView({behavior:'smooth',block:'start'})};renderBank();\n$('startTrainer').onclick=()=>show('setup');$('resume').onclick=()=>startTrainer(saved());\n$('create').onclick=async()=>{const b=$('create');b.disabled=true;try{const durationSeconds=readDuration();const payload={durationSeconds,mode,identity,title:$('title').value.trim(),question:$('question').value.trim(),options:Array.from({length:optionCount},(_,i)=>i).map(i=>$('option'+i).value.trim())};if(!payload.title||!payload.question||(mode!=='text'&&payload.options.some(x=>!x)))throw new Error(t(\"كمّل عنوان السيشن والسؤال وكل الاختيارات.\"));if(mode==='ranking'){payload.hasCorrect=rankingCorrect;if(rankingCorrect){if($('correctChoice').value==='')throw new Error(t('اختار الإجابة الصحيحة من الاختيارات.'));payload.correctChoice=Number($('correctChoice').value);}if(pendingRanking)payload.rankingRound=pendingRanking;}const d=await api('/sessions',payload);pendingRanking=null;$('continuingRanking').classList.add('hidden');save(d);await startTrainer(d)}catch(e){error(e)}finally{b.disabled=false}};\nasync function startTrainer(info){if(!info)return;current=info;show('trainer');const u=location.origin+joinPath+'?code='+info.code+'&lang='+lang;$('sessionCode').textContent=info.code;for(const id of ['joinUrl','openJoin','qrLink'])$(id).href=u;$('joinUrl').textContent=u;$('qr').src=apiOrigin+'/qr?code='+info.code+'&lang='+lang+(pagesHost?'&frontend=pages':'');await refreshTrainer();timer=setInterval(()=>{if(!document.hidden)refreshTrainer()},5000)}\nasync function refreshTrainer(){try{const d=await api('/sessions/'+current.code+'/results',null,current.token);current={...current,...d};renderRanking(d);$('trainerTitle').textContent=d.title;$('resultQuestion').textContent=d.question;$('total').textContent=d.total;$('empty').classList.toggle('hidden',d.total>0);$('toggle').disabled=!!d.timeUp||!!d.roundEnded;$('pollStatus').textContent=d.timeUp?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):d.open?(d.mode==='text'?t(\"استقبال الردود مفتوح\"):t(\"التصويت مفتوح\")):(d.mode==='text'?t(\"استقبال الردود مقفول\"):t(\"التصويت مقفول\"));$('toggle').textContent=d.roundEnded?t('الجولة انتهت. ابدأ جولة جديدة.'):d.timeUp?t('الوقت خلص'):d.open?(d.mode==='text'?t(\"اقفل الردود\"):t(\"اقفل التصويت\")):(d.mode==='text'?t(\"افتح الردود\"):t(\"افتح التصويت\"));$('results').innerHTML=d.mode==='text'?d.answers.map((a,i)=>'<article class=\"written-answer\"><small dir=\"auto\">'+esc(d.identity==='named'?a.name||t(\"مشارك\"):t(\"رد \")+(d.total-i))+'</small><div dir=\"auto\">'+esc(a.answer)+'</div></article>').join(''):d.options.map((o,i)=>{const n=d.counts[i],p=d.total?Math.round(n/d.total*100):0;return '<div><div class=\"result-head\"><span>'+esc(o)+'</span><strong dir=\"ltr\">'+n+' · '+p+'%</strong></div><div class=\"track\"><div class=\"bar\" style=\"width:'+p+'%\"></div></div></div>'}).join('');$('namedPollSection').classList.toggle('hidden',d.identity!=='named'||d.mode==='text'||d.mode==='ranking');$('namedPollAnswers').innerHTML=(d.respondents||[]).map(a=>'<article class=\"written-answer\"><small dir=\"auto\">'+esc(a.name)+'</small><div>'+esc(d.options[a.choice])+'</div></article>').join('');$('connection').innerHTML='<span class=\"dot\"></span>'+t(\"متصل · آخر تحديث \")+new Date().toLocaleTimeString(lang==='en'?'en-GB':'ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit'});$('globalError').textContent='';updateCountdown()}catch(e){$('connection').textContent=t(\"التحديث متوقف مؤقتاً، بنحاول تاني\");error(e)}}\n$('toggle').onclick=async()=>{const b=$('toggle');b.disabled=true;try{await api('/sessions/'+current.code+'/status',{open:!current.open},current.token);await refreshTrainer()}catch(e){error(e)}finally{b.disabled=false}};\n$('copyJoin').onclick=async()=>{try{await navigator.clipboard.writeText($('joinUrl').href);$('copyJoin').textContent=t(\"اتنسخ الرابط\")}catch{$('copyJoin').textContent=t(\"انسخ الرابط المكتوب تحت الزر\")}};\n$('newSession').onclick=()=>{pendingRanking=null;$('continuingRanking').classList.add('hidden');$('newConfirm').classList.remove('hidden')};$('cancelNew').onclick=()=>$('newConfirm').classList.add('hidden');$('confirmNew').onclick=async()=>{try{await api('/sessions/'+current.code+(current.mode==='ranking'?'/finish':'/status'),current.mode==='ranking'?{}:{open:false},current.token);$('newConfirm').classList.add('hidden');show('setup')}catch(e){error(e)}};\n$('joinButton').onclick=join;$('joinCode').addEventListener('keydown',e=>{if(e.key==='Enter')join()});\nasync function join(){const code=$('joinCode').value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));if(!/^\\d{6}$/.test(code)){error(new Error(t(\"اكتب كود السيشن المكوّن من ٦ أرقام.\")));return}$('joinButton').disabled=true;try{current=await api('/sessions/'+code+'?client='+encodeURIComponent(client()));selected=-1;try{$('participantName').value=sessionStorage.getItem('hall.name')||''}catch{}$('writtenAnswer').value='';$('charCount').textContent='0';show('participant');renderParticipant();timer=setInterval(()=>{if(!document.hidden)refreshParticipant()},5000)}catch(e){error(e)}finally{$('joinButton').disabled=false}}\nfunction renderParticipant(){if(timerRemaining()===0)current.open=false;const text=current.mode==='text',named=current.identity==='named',missingName=named&&!$('participantName').value.trim();$('nameEntry').classList.toggle('hidden',!named||current.voted);$('participantName').disabled=current.voted||sending;$('textPrivacy').textContent=named?t(\"ردك واسمك بيوصلوا للمدرب فقط.\"):t(\"ردك من غير اسم، وبيوصل للمدرب فقط.\");$('rankingParticipantInfo').classList.toggle('hidden',current.mode!=='ranking');$('rankingParticipantRule').textContent=t(current.hasCorrect?'رانكينج · أسرع إجابة صحيحة':'رانكينج · أسرع إجابة');for(const el of $('participant').querySelectorAll('[data-normal-only]'))el.classList.toggle('hidden',current.mode==='ranking');$('answerType').textContent=current.mode==='ranking'?t(current.hasCorrect?'رانكينج · أسرع إجابة صحيحة':'رانكينج · أسرع إجابة'):text?t(\"سؤال مفتوح · إجابة مكتوبة\"):t(\"تصويت سريع · اختيار واحد\");$('choices').classList.toggle('hidden',text);$('textEntry').classList.toggle('hidden',!text);$('writtenAnswer').disabled=!current.open||current.voted||sending;$('participantTitle').textContent=current.title;$('participantQuestion').textContent=current.question;$('choices').innerHTML=current.options.map((o,i)=>'<button class=\"choice '+(selected===i?'selected':'')+'\" data-choice=\"'+i+'\" aria-pressed=\"'+(selected===i)+'\" '+((!current.open||current.voted||sending)?'disabled':'')+'><span class=\"number\">'+(i+1)+'</span><span class=\"answer\" dir=\"auto\">'+esc(o)+'</span><span aria-hidden=\"true\">'+(selected===i?'✓':'○')+'</span></button>').join('');for(const el of document.querySelectorAll('[data-choice]'))el.onclick=()=>{selected=Number(el.dataset.choice);renderParticipant()};$('vote').textContent=text?t(\"ابعث إجابتي\"):t(\"ثبّت إجابتي\");$('vote').disabled=(text?!$('writtenAnswer').value.trim():selected<0)||missingName||!current.open||current.voted||sending;$('vote').classList.toggle('hidden',current.voted);$('voteStatus').classList.toggle('hidden',!current.voted&&current.open);$('voteStatus').textContent=current.timeUp&&!current.voted?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):current.voted?t(\"اتسجّل ردك ووصل للمدرب. شكراً لمشاركتك.\"):t(\"المدرب قفل استقبال الردود. لو فتحه تاني هتقدر تشارك.\");updateCountdown();$('participantConnection').textContent=current.timeUp?t('الوقت خلص. استقبال الردود اتقفل تلقائياً.'):current.open?t(\"متصل · استقبال الردود مفتوح\"):t(\"متصل · استقبال الردود مقفول\")}\nasync function refreshParticipant(){try{current=await api('/sessions/'+current.code+'?client='+encodeURIComponent(client()));renderParticipant();$('globalError').textContent=''}catch(e){$('participantConnection').textContent=t(\"تعذّر تحديث حالة السيشن\");$('vote').disabled=true;error(e)}}\n$('vote').onclick=async()=>{if((current.mode==='text'?!$('writtenAnswer').value.trim():selected<0)||(current.identity==='named'&&!$('participantName').value.trim())||sending)return;sending=true;renderParticipant();try{await api('/sessions/'+current.code+'/vote',{client:client(),name:current.identity==='named'?$('participantName').value:undefined,choice:selected,answer:current.mode==='text'?$('writtenAnswer').value.trim():undefined});await refreshParticipant()}catch(e){error(e);await refreshParticipant()}finally{sending=false;renderParticipant()}};\nwindow.addEventListener('online',()=>{if(role==='trainer'){renderRanking(current);refreshTrainer()};if(role==='participant')refreshParticipant()});\n\nlet timerEnabled=false,expiredCountdownKey='';\nfunction setTimer(v){timerEnabled=v;$('timerOff').setAttribute('aria-pressed',String(!v));$('timerOn').setAttribute('aria-pressed',String(v));$('timerDuration').classList.toggle('hidden',!v)}\nfunction readDuration(){if(!timerEnabled)return 0;const m=$('timerMinutes').value.trim(),s=$('timerSeconds').value.trim();if(!/^\\d+$/.test(m)||!/^\\d+$/.test(s)||Number(m)>1439||Number(s)>59||Number(m)*60+Number(s)<1)throw new Error(t('اكتب الدقائق من ٠ لحد ١٤٣٩ والثواني من ٠ لحد ٥٩. المدة لازم تكون ثانية على الأقل.'));return Number(m)*60+Number(s)}\nfunction timerRemaining(){if(!current?.endsAt)return null;return Math.max(0,Math.ceil((current.endsAt-(current.serverNow+(performance.now()-(current.receivedAt??performance.now()))))/1000))}\nfunction updateCountdown(){const left=timerRemaining();for(const [id,view] of [['trainerCountdown','trainer'],['participantCountdown','participant']]){const el=$(id),visible=role===view&&left!==null;el.classList.toggle('hidden',!visible);if(!visible)continue;el.querySelector('.countdown-label').textContent=t(left===0?'الوقت خلص':'الوقت المتبقي');el.querySelector('.countdown-value').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');el.classList.toggle('urgent',left>0&&left<=10);el.classList.toggle('expired',left===0);const note=el.querySelector('.countdown-note');note.classList.toggle('hidden',left!==0);note.textContent=t('الوقت خلص. استقبال الردود اتقفل تلقائياً.')}if(left===0&&current){current.open=false;current.timeUp=true;const key=current.code+':'+current.endsAt;if(expiredCountdownKey!==key){expiredCountdownKey=key;if(role==='participant')queueMicrotask(()=>{renderParticipant();refreshParticipant()});if(role==='trainer'){ $('toggle').disabled=true;$('toggle').textContent=t('الوقت خلص');$('pollStatus').textContent=t('الوقت خلص. استقبال الردود اتقفل تلقائياً.');queueMicrotask(refreshTrainer)}}}}\n$('timerOff').onclick=()=>setTimer(false);$('timerOn').onclick=()=>setTimer(true);setInterval(updateCountdown,200);\n\nlet theme='light';try{theme=localStorage.getItem('roompulse.theme')||'light'}catch{}if(!['light','dark'].includes(theme))theme='light';\nfunction applyTheme(){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='dark'?'dark':'light';const b=document.getElementById('themeToggle');if(b){b.setAttribute('aria-pressed',String(theme==='dark'));b.setAttribute('aria-label',t('تغيير المظهر'));document.getElementById('themeLabel').textContent=t(theme==='dark'?'الوضع الفاتح':'الوضع الداكن')}}\nfunction toggleTheme(){theme=theme==='dark'?'light':'dark';try{localStorage.setItem('roompulse.theme',theme)}catch{}applyTheme()}\n$('themeToggle').onclick=()=>{toggleTheme();drawWheel()};applyTheme();\n\nlet rankingCorrect=false,pendingRanking=null;\nfunction setRankingCorrect(v){rankingCorrect=v;$('rankingHasCorrect').setAttribute('aria-pressed',String(v));$('rankingNoCorrect').setAttribute('aria-pressed',String(!v));$('correctChoiceBox').classList.toggle('hidden',!v)}\n$('rankingHasCorrect').onclick=()=>setRankingCorrect(true);$('rankingNoCorrect').onclick=()=>setRankingCorrect(false);\n$('separateRanking').onclick=()=>{pendingRanking=null;$('continuingRanking').classList.add('hidden')};\nfunction rankingRows(rows,round=false){return rows.map(a=>'<article class=\"ranking-row\"><div class=\"ranking-place\">'+a.rank+'</div><div><strong dir=\"auto\">'+esc(a.name||t('مشارك ')+a.participant)+'</strong><small>'+esc(round?a.correctAnswers+' '+t('إجابات مؤهلة'):(a.elapsedMs/1000).toFixed(3)+' '+t('ثانية'))+'</small></div><div class=\"ranking-points\">'+a.points+'<small>'+t('نقطة')+'</small></div></article>').join('')}\nfunction renderRanking(d){if(!d)return;const is=d.mode==='ranking';$('rankingResults').classList.toggle('hidden',!is);$('results').classList.toggle('hidden',is);for(const el of $('trainer').querySelectorAll('[data-normal-only]'))el.classList.toggle('hidden',is);$('newSession').textContent=t(is?'جولة جديدة':'سيشن جديد');if(!is)return;$('rankingHint').textContent=d.roundEnded?t('الجولة خلصت. السكور النهائي ظاهر تحت.'):!d.rankingReady?t('اقفل الردود أو استنى المؤقت يخلص عشان يظهر ترتيب السؤال.'):(d.leaderboard?.length?'':t('مفيش إجابات مؤهلة للترتيب لسه.'));$('rankingList').innerHTML=rankingRows(d.leaderboard||[]);$('roundResults').classList.toggle('hidden',!d.roundEnded);$('roundList').innerHTML=rankingRows(d.roundLeaderboard||[],true);$('nextRanking').classList.toggle('hidden',!!d.roundEnded);$('finishRanking').classList.toggle('hidden',!!d.roundEnded);$('newSession').textContent=t('جولة جديدة');}\n$('nextRanking').onclick=async()=>{try{await api('/sessions/'+current.code+'/status',{open:false},current.token);pendingRanking={code:current.code,token:current.token};$('continuingRanking').classList.remove('hidden');$('question').value='';for(let i=0;i<3;i++)$('option'+i).value='';$('correctChoice').value='';$('bankSelected').textContent='';delete $('bankSelected').dataset.questionId;setMode('ranking');setIdentity(current.identity);show('setup')}catch(e){error(e)}};\n$('finishRanking').onclick=async()=>{if(!confirm(t('إنهاء الجولة يقفل كل أسئلتها نهائياً. متأكد؟')))return;const b=$('finishRanking');b.disabled=true;try{await api('/sessions/'+current.code+'/finish',{},current.token);await refreshTrainer()}catch(e){error(e)}finally{b.disabled=false}};\n\nlet wheelItems=[],wheelRotation=0,wheelSpinning=false,wheelWinner=null,wheelFrame=null;\nfunction wheelEntries(){return $('wheelEntries').value.split(/\\r?\\n/).map(s=>s.trim()).filter(Boolean)}\nfunction validateWheel(items){if(items.length<2)throw new Error(t('اكتب عنصرين على الأقل، كل عنصر في سطر.'));if(items.length>200)throw new Error(t('الحد الأقصى ٢٠٠ عنصر في اللفة.'));if(items.some(x=>x.length>100))throw new Error(t('كل عنصر لحد ١٠٠ حرف.'));}\nfunction wheelChanged(){if(wheelSpinning)return;wheelItems=wheelEntries();wheelWinner=null;$('wheelWinner').textContent='';$('wheelResult').classList.add('hidden');$('wheelCount').textContent=wheelItems.length+' '+t('عنصر');$('wheelSpin').disabled=wheelItems.length<2||wheelItems.length>200||wheelItems.some(x=>x.length>100);wheelRotation=0;drawWheel();}\nfunction wheelColor(i,n){const dark=theme==='dark';const colors=dark?['#E60000','#7F1D1D','#DA6B6B','#572C32','#9D3945','#BD5B40']:['#E60000','#FBE4E4','#EF8F8F','#8B1515','#F4B8AD','#BA4B4B'];return colors[i%colors.length]}\nfunction wheelRandomIndex(n){const bound=Math.floor(4294967296/n)*n;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=bound);return x%n}\nfunction drawWheel(){const canvas=$('wheelCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),size=720,c=size/2,r=338;canvas.width=size;canvas.height=size;ctx.clearRect(0,0,size,size);const n=wheelItems.length,items=n?wheelItems:[t('أضف العناصر')],step=Math.PI*2/items.length;ctx.save();ctx.translate(c,c);ctx.rotate(wheelRotation-Math.PI/2);items.forEach((item,i)=>{const a=i*step;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,a,a+step);ctx.closePath();ctx.fillStyle=n?wheelColor(i,items.length):(theme==='dark'?'#292125':'#FBE4E4');ctx.fill();ctx.strokeStyle=theme==='dark'?'#111':'#fff';ctx.lineWidth=2;ctx.stroke();if(items.length<=40){ctx.save();ctx.rotate(a+step/2);ctx.translate(r*.64,0);ctx.rotate(Math.PI/2);ctx.fillStyle=n&&[0,3,5].includes(i%6)?'#fff':'#181818';if(theme==='dark')ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 '+(items.length>20?15:items.length>12?20:25)+'px Arial, sans-serif';let label=item;const width=items.length>12?95:160;while(ctx.measureText(label).width>width&&label.length>1)label=label.slice(0,-2);if(label!==item)label+='…';ctx.fillText(label,0,0);ctx.restore();}});ctx.restore();ctx.beginPath();ctx.arc(c,c,43,0,Math.PI*2);ctx.fillStyle=theme==='dark'?'#202126':'#fff';ctx.fill();ctx.lineWidth=6;ctx.strokeStyle='#E60000';ctx.stroke();ctx.fillStyle='#E60000';ctx.font='900 21px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('RP',c,c);ctx.beginPath();ctx.moveTo(c-20,7);ctx.lineTo(c+20,7);ctx.lineTo(c,52);ctx.closePath();ctx.fillStyle=theme==='dark'?'#fff':'#191919';ctx.fill();canvas.setAttribute('aria-label',t('عجلة اختيار عشوائي')+' · '+wheelItems.length+' '+t('عنصر'));}\nfunction openWheel(){show('wheel');wheelChanged()}\nfunction renderWheelLanguage(){if(!$('wheelCanvas'))return;$('wheelCount').textContent=wheelItems.length+' '+t('عنصر');$('wheelSpin').textContent=t(wheelSpinning?'بتلف…':'لف العجلة');if(wheelWinner!==null)$('wheelWinner').textContent=wheelItems[wheelWinner];drawWheel()}\nasync function spinWheel(){if(wheelSpinning)return;try{wheelItems=wheelEntries();validateWheel(wheelItems)}catch(e){error(e);return}wheelSpinning=true;wheelWinner=null;$('wheelEntries').disabled=true;$('wheelSpin').disabled=true;$('wheelClear').disabled=true;$('wheelResult').classList.add('hidden');$('wheelSpin').textContent=t('بتلف…');$('globalError').textContent='';const index=wheelRandomIndex(wheelItems.length),step=Math.PI*2/wheelItems.length,base=wheelRotation,normalized=((base%(Math.PI*2))+Math.PI*2)%(Math.PI*2),target=2*Math.PI-(index+.5)*step,delta=6*Math.PI+((target-normalized+2*Math.PI)%(2*Math.PI)),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduce?0:4200,start=performance.now();const finish=()=>{wheelRotation=base+delta;wheelWinner=index;wheelSpinning=false;$('wheelEntries').disabled=false;$('wheelSpin').disabled=false;$('wheelClear').disabled=false;$('wheelSpin').textContent=t('لف العجلة');$('wheelWinner').textContent=wheelItems[index];$('wheelResult').classList.remove('hidden');drawWheel()};if(!duration){finish();return}await new Promise(resolve=>{const frame=now=>{const p=Math.min(1,(now-start)/duration);wheelRotation=base+delta*(1-Math.pow(1-p,4));drawWheel();if(p<1)wheelFrame=requestAnimationFrame(frame);else{finish();resolve()}};wheelFrame=requestAnimationFrame(frame)});}\n$('wheelTab').onclick=openWheel;$('openWheel').onclick=openWheel;$('activitiesTab').onclick=()=>show('welcome');$('wheelEntries').oninput=wheelChanged;$('wheelSpin').onclick=spinWheel;$('wheelClear').onclick=()=>{if(wheelSpinning)return;if(!$('wheelEntries').value||confirm(t('تمسح كل عناصر العجلة؟'))){$('wheelEntries').value='';wheelChanged()}};\n\n/* ===== QUIZ MODULE (client) ===== */\nObject.assign(EN,{\n\"كويز\":\"Quiz\",\"مكتبة الكويزات\":\"Quiz library\",\"كويز جديد\":\"New quiz\",\"استيراد من ملف Excel (CSV)\":\"Import from Excel (CSV)\",\"قالب جاهز\":\"Template\",\"تغيير كلمة السر\":\"Change passcode\",\"خروج\":\"Log out\",\n\"أول مرة؟ اختار كلمة سر للصفحة دي. هتكتبها أنت هنا بنفسك، ومش هتتبعت في أي شات.\":\"First time here. Choose a passcode for this page. You type it yourself, it is never sent in chat.\",\n\"كلمة السر\":\"Passcode\",\"تأكيد كلمة السر\":\"Confirm passcode\",\"احفظ كلمة السر\":\"Save passcode\",\"ادخل\":\"Enter\",\"كلمتين السر مش زي بعض.\":\"The two passcodes do not match.\",\n\"ادخل كلمة السر عشان تفتح مكتبة الكويزات.\":\"Enter your passcode to open the quiz library.\",\"مفيش كويزات لسه. اعمل أول كويز.\":\"No quizzes yet. Create your first one.\",\n\"سؤال\":\"questions\",\"تشغيل\":\"Run\",\"تعديل\":\"Edit\",\"نسخ\":\"Duplicate\",\"حذف\":\"Delete\",\"تمسح الكويز ده نهائياً؟\":\"Delete this quiz permanently?\",\"آخر تعديل\":\"Last edited\",\n\"الكويزات بتتحفظ وتفضل موجودة لحد ما تمسحها.\":\"Quizzes are saved and stay until you delete them.\",\"عندك لعبة شغالة\":\"You have a game in progress\",\"ارجع للعبة\":\"Back to the game\",\n\"اسم الكويز\":\"Quiz name\",\"أضف سؤال\":\"Add a question\",\"اختيار من متعدد\":\"Multiple Choice\",\"اكتشف الغلطة\":\"Spot the Mistake\",\"سحابة كلمات\":\"Word Cloud\",\n\"نص السؤال\":\"Question text\",\"الموقف أو التعليمات\":\"Situation or instruction\",\"اختار الإجابة الصح\":\"Mark the correct answer\",\"اختار السطر الغلط\":\"Mark the mistake\",\"إضافة اختيار\":\"Add choice\",\"إضافة سطر\":\"Add line\",\n\"اختيار\":\"Choice\",\"سطر في المحادثة\":\"Chat line\",\"الوقت بالثواني\":\"Time (seconds)\",\"احذف السؤال\":\"Delete question\",\"فوق\":\"Up\",\"تحت\":\"Down\",\"احفظ الكويز\":\"Save quiz\",\"إلغاء\":\"Cancel\",\"تصدير CSV\":\"Export CSV\",\n\"اتحفظ الكويز.\":\"Quiz saved.\",\"اكتب اسم الكويز.\":\"Enter a quiz name.\",\"أضف سؤال واحد على الأقل.\":\"Add at least one question.\",\"اكتب نص كل سؤال.\":\"Write the text of every question.\",\"كمّل اختيارات كل سؤال.\":\"Complete the choices of every question.\",\"حدد الإجابة الصح في كل سؤال.\":\"Mark the correct answer in every question.\",\n\"الكل يكتب كلمة قصيرة وتظهر سحابة حية.\":\"Everyone types a short word and a live cloud appears.\",\"المتدرب يختار من موبايله، والنقاط بالسرعة.\":\"Players pick on their phones. Points reward speed.\",\"محادثة فيها غلطة، والمتدرب يختار السطر الغلط.\":\"A conversation with one mistake. Players pick the wrong line.\",\n\"شغّل الكويز\":\"Run the quiz\",\"كل واحد لوحده\":\"Everyone solo\",\"فرق\":\"Teams\",\"عدد الفرق\":\"Number of teams\",\"ابدأ اللوبي\":\"Open the lobby\",\"الكويز\":\"Quiz\",\n\"ادخل على الرابط واكتب الكود\":\"Open the link and enter the code\",\"أو امسح الـ QR\":\"or scan the QR\",\"انضموا\":\"joined\",\"إنهاء اللعبة\":\"End game\",\"تنهي اللعبة دلوقتي؟ هتتسجل في السجل.\":\"End the game now? It will be saved to History.\",\"استنى المتدربين يدخلوا…\":\"Waiting for players…\",\"ابدأ الكويز\":\"Start quiz\",\n\"أجاوبوا\":\"answered\",\"اعرض النتيجة دلوقتي\":\"Show results now\",\"السؤال التالي\":\"Next question\",\"اعرض النتيجة النهائية\":\"Show final results\",\"الإجابة الصح\":\"Correct answer\",\"الترتيب\":\"Leaderboard\",\"ترتيب الفرق\":\"Team standings\",\"الفريق\":\"Team\",\"نقطة\":\"pts\",\"عضو\":\"members\",\n\"النتيجة النهائية\":\"Final results\",\"تقرير الجلسة\":\"Session report\",\"صح\":\"correct\",\"محتاج مراجعة\":\"needs review\",\"اللي غلطوا\":\"Got it wrong\",\"ماجاوبوش\":\"No answer\",\"رجوع للمكتبة\":\"Back to library\",\"تصدير النتايج CSV\":\"Export results CSV\",\"جاري تجهيز التقرير…\":\"Preparing the report…\",\n\"اكتب اسمك\":\"Enter your name\",\"ادخل الكويز\":\"Join the quiz\",\"أنت جوّه. استنى المدرب يبدأ.\":\"You are in. Wait for the trainer to start.\",\"فريقك\":\"Your team\",\"اتسجلت إجابتك. استنى باقي القاعة…\":\"Answer locked in. Waiting for the room…\",\"ابعت\":\"Send\",\"اكتب كلمة\":\"Type a word\",\"ابعت الإجابة\":\"Send answer\",\n\"إجابة صح!\":\"Correct!\",\"الملف مش Excel صالح.\":\"This is not a valid Excel file.\",\"المتصفح ده مش بيفتح xlsx. احفظ الملف CSV.\":\"This browser cannot open xlsx. Save the file as CSV.\",\"استيراد من Excel (xlsx أو CSV)\":\"Import from Excel (xlsx or CSV)\",\"تحميل قالب Excel\":\"Download Excel template\",\"السجل\":\"History\",\"الطريقة: حمّل القالب، املاه (صف لكل سؤال)، وارفعه هنا من استيراد.\":\"How: download the template, fill it (one row per question), then upload it here with Import.\",\"لاعب\":\"players\",\"الأسئلة\":\"Questions\",\"تصدير الجدول CSV\":\"Export table CSV\",\"احذف من السجل\":\"Delete from history\",\"رجوع\":\"Back\",\"كل لعبة بتخلص بتتحفظ هنا لحد ما تمسحها.\":\"Every finished game is saved here until you delete it.\",\"تفاصيل\":\"Details\",\"احذف\":\"Delete\",\"لسه مفيش ألعاب مخلصة.\":\"No finished games yet.\",\"تمسح اللعبة دي من السجل نهائياً؟\":\"Delete this game from history permanently?\",\"أقصى نقاط للسؤال\":\"Max points for this question\",\"الإجابة الصح الأسرع بتاخد نقاط أكتر. الغلط بصفر.\":\"Faster correct answers earn more. Wrong answers get 0.\",\"شارك الرابط\":\"Share link\",\"انضم للكويز\":\"Join the quiz\",\"الكود\":\"Code\",\"اتنسخ الرابط والكود\":\"Link and code copied\",\"انسخ الرابط\":\"Copy the link\",\"إجابة غلط\":\"Wrong\",\"وقتك خلص\":\"Time is up\",\"نقاطك\":\"Your score\",\"مركزك\":\"Your rank\",\"ترتيب فريقك\":\"Your team rank\",\"الكويز خلص. شكراً على المشاركة!\":\"The quiz is over. Thanks for playing!\",\"استنى السؤال الجاي…\":\"Waiting for the next question…\",\"ما جاوبتش\":\"No answer\",\n\"الكود غير صحيح أو الكويز انتهى.\":\"The code is wrong or the quiz has ended.\",\"كلمة السر غلط.\":\"Wrong passcode.\",\"اكتب كلمة السر الأول.\":\"Enter the passcode first.\",\"الجلسة انتهت. ادخل كلمة السر تاني.\":\"Session expired. Enter the passcode again.\",\n\"كلمة السر من ٤ لـ ٦٤ حرف أو رقم.\":\"Passcode must be 4 to 64 characters.\",\"كلمة السر متحددة بالفعل. ادخل بيها.\":\"The passcode is already set. Enter it.\",\"محاولات كتير غلط. استنى ١٥ دقيقة وجرّب تاني.\":\"Too many wrong attempts. Wait 15 minutes and try again.\",\n\"الكويز مش موجود.\":\"Quiz not found.\",\"وصلت للحد الأقصى ١٠٠ كويز. امسح كويز قديم.\":\"Limit of 100 quizzes reached. Delete an old one.\",\"مفيش مشاركين لسه.\":\"No players yet.\",\"الكويز بدأ بالفعل.\":\"The quiz already started.\",\"السؤال ده مش مفتوح.\":\"This question is not open.\",\"الوقت خلص.\":\"Time is up.\",\"ادخل بالاسم الأول.\":\"Join with your name first.\",\n\"اكتب اسمك لحد ٤٠ حرف.\":\"Enter your name, up to 40 characters.\",\"وصلنا للحد الأقصى ٢٠٠ مشارك.\":\"Limit of 200 players reached.\",\"الكويز خلص.\":\"The quiz has ended.\",\"اكتب كلمة أو جملة قصيرة لحد ٣٠ حرف.\":\"Type a short word or phrase, up to 30 characters.\",\"اختيار غير صحيح.\":\"Invalid choice.\",\"شاشة المدرب دي مش متاحة من المتصفح الحالي.\":\"This trainer screen is not available from this browser.\",\n\"الملف مفيهوش أسئلة صالحة.\":\"The file has no valid questions.\",\"اتفتح الكويز من الملف. راجعه واحفظه.\":\"Quiz loaded from the file. Review it and save.\",\"الشعار\":\"Logo\"\n});\nconst Q={tok:null,view:'auth',lib:[],draft:null,draftId:null,launch:null,host:null,gs:null,off:0,pl:null,poll:null,sel:-1,report:null,sig:'',configured:null};\ntry{Q.tok=localStorage.getItem('quiz.admin')}catch{}\ntry{Q.host=JSON.parse(sessionStorage.getItem('quiz.host')||'null')}catch{}\nconst qapi=(p,b,tk)=>api('/quiz'+p,b,tk);\nconst qroot=()=>$(role==='quizPlay'?'quizPlayRoot':'quizRoot');\nconst SYM=['▲','◆','●','■','★','✚'];\nfunction qsetTok(v){Q.tok=v;try{v?localStorage.setItem('quiz.admin',v):localStorage.removeItem('quiz.admin')}catch{}}\nfunction qhostSave(){try{Q.host?sessionStorage.setItem('quiz.host',JSON.stringify(Q.host)):sessionStorage.removeItem('quiz.host')}catch{}}\nfunction qstop(){clearInterval(Q.poll);Q.poll=null}\nfunction qerr(e){if(/الجلسة انتهت/.test(e.message)&&Q.tok&&role==='quiz'){qsetTok(null);Q.view='auth'}error(e);}\nconst fmtp=n=>{n=Math.round((+n||0)*100)/100;return Number.isInteger(n)?String(n):n.toFixed(2).replace(/0$/,'')};\nfunction qrem(s){return Math.max(0,Math.ceil((s.qEnd-(Date.now()+Q.off))/1000))}\nfunction qnum(n){return String(n)}\nfunction qblank(type){return type==='cloud'?{type,text:'',time:30}:{type,text:'',options:type==='spot'?['','']:['','',''],correct:0,time:20,points:10}}\n/* ---------- host: open ---------- */\nasync function openQuiz(){show('quiz');Q.sig='';if(Q.host&&Q.view==='host'){startHostPoll();return}\n try{const st=await qapi('/admin/status');Q.configured=st.configured}catch(e){error(e);return}\n if(Q.tok){try{const l=await qapi('/library',null,Q.tok);Q.lib=l.quizzes;Q.view='lib'}catch(e){qsetTok(null);Q.view='auth'}}else Q.view='auth';\n qrender()}\nfunction qrender(){if(role!=='quiz')return;const r=$('quizRoot');\n if(Q.view==='auth')return authView(r);if(Q.view==='lib')return libView(r);if(Q.view==='edit')return editView(r);if(Q.view==='launch')return launchView(r);if(Q.view==='host')return hostView(r);if(Q.view==='hist')return histView(r)}\nfunction authView(r){const setup=!Q.configured;r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><h2>'+t('كويز')+'</h2><div class=\"qglass\"><p>'+t(setup?'أول مرة؟ اختار كلمة سر للصفحة دي. هتكتبها أنت هنا بنفسك، ومش هتتبعت في أي شات.':'ادخل كلمة السر عشان تفتح مكتبة الكويزات.')+'</p><div class=\"fields\"><div><label for=\"qpass\">'+t('كلمة السر')+'</label><input id=\"qpass\" type=\"password\" autocomplete=\"'+(setup?'new-password':'current-password')+'\"></div>'+(setup?'<div><label for=\"qpass2\">'+t('تأكيد كلمة السر')+'</label><input id=\"qpass2\" type=\"password\" autocomplete=\"new-password\"></div>':'')+'</div><div class=\"actions\"><button id=\"qauth\">'+t(setup?'احفظ كلمة السر':'ادخل')+'</button></div></div>';\n const go=async()=>{const p=$('qpass').value;try{if(setup&&p!==$('qpass2').value)throw new Error(t('كلمتين السر مش زي بعض.'));const d=await qapi(setup?'/admin/setup':'/admin/login',{passcode:p});qsetTok(d.token);Q.configured=true;const l=await qapi('/library',null,d.token);Q.lib=l.quizzes;Q.view='lib';qrender()}catch(e){error(e)}};\n $('qauth').onclick=go;$('qpass').onkeydown=e=>{if(e.key==='Enter'&&!setup)go()}}\nfunction fmtDate(ts){try{return new Date(ts).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB')}catch{return''}}\nfunction typeName(x){return t(x==='mc'?'اختيار من متعدد':x==='spot'?'اكتشف الغلطة':'سحابة كلمات')}\nfunction libView(r){\n r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><div class=\"qrow between\"><h2>'+t('مكتبة الكويزات')+' ('+Q.lib.length+')</h2><button id=\"qnew\">+ '+t('كويز جديد')+'</button></div>'\n +(Q.host?'<div class=\"notice\"><p>'+t('عندك لعبة شغالة')+' · <bdi dir=\"ltr\">'+Q.host.code+'</bdi></p><div class=\"qrow\"><button class=\"secondary\" id=\"qresume\">'+t('ارجع للعبة')+'</button><button class=\"secondary qbtn-danger\" id=\"qendlib\">'+t('إنهاء اللعبة')+'</button></div></div>':'')\n +'<div id=\"qlist\">'+(Q.lib.length?Q.lib.map(x=>'<div class=\"qitem\" data-id=\"'+esc(x.id)+'\"><span><b dir=\"auto\">'+esc(x.title)+'</b><small>'+x.count+' '+t('سؤال')+' · '+x.types.map(typeName).join('، ')+' · '+t('آخر تعديل')+' '+fmtDate(x.updated)+'</small></span><span class=\"qrow\"><button data-a=\"run\">'+t('تشغيل')+'</button><button class=\"secondary\" data-a=\"edit\">'+t('تعديل')+'</button><button class=\"secondary\" data-a=\"dup\">'+t('نسخ')+'</button><button class=\"secondary\" data-a=\"csv\">CSV</button><button class=\"secondary qbtn-danger\" data-a=\"del\">'+t('حذف')+'</button></span></div>').join(''):'<p class=\"muted\">'+t('مفيش كويزات لسه. اعمل أول كويز.')+'</p>')+'</div>'\n +'<div class=\"qrow\" style=\"margin-top:18px\"><label class=\"btn secondary\" style=\"margin:0\">'+t('استيراد من Excel (xlsx أو CSV)')+'<input id=\"qfile\" type=\"file\" accept=\".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\" hidden></label><button class=\"secondary\" id=\"qtpl\">'+t('تحميل قالب Excel')+'</button><button class=\"secondary\" id=\"qhist\">'+t('السجل')+'</button><button class=\"secondary\" id=\"qchg\">'+t('تغيير كلمة السر')+'</button><button class=\"secondary\" id=\"qout\">'+t('خروج')+'</button></div><p class=\"muted\">'+t('الكويزات بتتحفظ وتفضل موجودة لحد ما تمسحها.')+'</p><p class=\"muted\">'+t('الطريقة: حمّل القالب، املاه (صف لكل سؤال)، وارفعه هنا من استيراد.')+'</p>';\n $('qnew').onclick=()=>{Q.draft={title:'',questions:[qblank('mc')]};Q.draftId=null;Q.view='edit';qrender()};\n if($('qendlib'))$('qendlib').onclick=qendGame;if($('qresume'))$('qresume').onclick=()=>{Q.view='host';Q.sig='';startHostPoll()};\n $('qlist').onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;const id=b.closest('.qitem').dataset.id,a=b.dataset.a;try{\n  if(a==='del'){if(!confirm(t('تمسح الكويز ده نهائياً؟')))return;await qapi('/library/delete',{id},Q.tok);await qreloadLib();return}\n  const d=await qapi('/library/'+id,null,Q.tok);\n  if(a==='edit'){Q.draft=d.quiz;Q.draftId=id;Q.view='edit';qrender()}\n  else if(a==='dup'){const c={...d.quiz,title:d.quiz.title+' (2)'};await qapi('/library/save',{quiz:c},Q.tok);await qreloadLib()}\n  else if(a==='csv')qdownload(toCSV(d.quiz),d.quiz.title+'.csv');\n  else if(a==='run'){Q.launch={id,title:d.quiz.title,teams:0};Q.view='launch';qrender()}}catch(er){qerr(er)}};\n $('qfile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const q=/\\.xlsx$/i.test(f.name)?fromRows(await xlsxRows(f)):fromCSV(await f.text());Q.draft=q;Q.draftId=null;Q.view='edit';qrender();$('globalError').textContent=''}catch(er){error(er)}};\n $('qtpl').onclick=()=>qdlBlob(xlsxBuild(qtemplateSheets()),'quiz-template.xlsx');\n $('qhist').onclick=async()=>{try{const d=await qapi('/history',null,Q.tok);Q.hist=d;Q.histOpen=null;Q.view='hist';qrender();$('globalError').textContent=''}catch(e){qerr(e)}};\n $('qout').onclick=()=>{qsetTok(null);Q.view='auth';qrender()};\n $('qchg').onclick=async()=>{const o=prompt(t('كلمة السر'));if(!o)return;const n=prompt(t('كلمة السر')+' (new)');if(!n)return;try{const d=await qapi('/admin/change',{passcode:o,newPasscode:n});qsetTok(d.token)}catch(er){error(er)}}}\nasync function qreloadLib(){const l=await qapi('/library',null,Q.tok);Q.lib=l.quizzes;Q.view='lib';qrender()}\n/* ---------- CSV ---------- */\nfunction qdownload(text,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\\ufeff'+text],{type:'text/csv;charset=utf-8'}));a.download=name.replace(/[\\\\/:*?\"<>|]/g,'_');document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}\nconst csvCell=v=>{v=String(v??'');return /[\",\\n;\\r]/.test(v)?'\"'+v.replace(/\"/g,'\"\"')+'\"':v};\nfunction toCSV(q){const rows=[['type','question','seconds','correct_number','option1','option2','option3','option4','option5','option6','max_points']];for(const x of q.questions)rows.push([x.type,x.text,x.time,x.options?x.correct+1:'',...Array.from({length:6},(_,k)=>(x.options||[])[k]||''),x.options?(x.points||10):'']);return rows.map(r=>r.map(csvCell).join(',')).join('\\r\\n')}\nfunction parseCSV(text){text=text.replace(/^\\ufeff/,'');const first=text.split(/\\r?\\n/)[0]||'';const d=[',',';','\\t'].map(c=>[c,first.split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='\"'){if(text[i+1]==='\"'){cell+='\"';i++}else q=false}else cell+=c}else if(c==='\"')q=true;else if(c===d){row.push(cell);cell=''}else if(c==='\\n'||c==='\\r'){if(c==='\\r'&&text[i+1]==='\\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}if(cell!==''||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(x=>x.trim()))}\nfunction fromCSV(text){return fromRows(parseCSV(text))}\nfunction fromRows(rows){if(rows.length&&/^type$/i.test(rows[0][0].trim()))rows.shift();const questions=[];for(const r of rows){const type=(r[0]||'').trim().toLowerCase();if(!['mc','spot','cloud'].includes(type))continue;const tx=(r[1]||'').trim();if(!tx)continue;const time=Math.min(240,Math.max(5,parseInt(r[2])||20));if(type==='cloud'){questions.push({type,text:tx,time});continue}const opts=r.slice(4,4+(type==='mc'?4:6)).map(x=>x.trim()).filter(Boolean);const cor=(parseInt(r[3])||1)-1;if(opts.length<2||cor<0||cor>=opts.length)continue;questions.push({type,text:tx,options:opts,correct:cor,time,points:Math.min(1000,Math.max(1,parseInt(r[10])||10))})}if(!questions.length)throw new Error(t('الملف مفيهوش أسئلة صالحة.'));return {title:'',questions:questions.slice(0,50)}}\n\n/* ---------- xlsx reader (no libraries; uses the browser's built-in inflate) ---------- */\nasync function xlsxRows(file){const buf=new Uint8Array(await file.arrayBuffer()),dv=new DataView(buf.buffer);let e=buf.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error(t('الملف مش Excel صالح.'));\n const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const F={};for(let i=0;i<n;i++){if(dv.getUint32(p,true)!==0x02014b50)break;const nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true);F[new TextDecoder().decode(buf.subarray(p+46,p+46+nl))]={m:dv.getUint16(p+10,true),c:dv.getUint32(p+20,true),o:dv.getUint32(p+42,true)};p+=46+nl+xl+cl}\n const rd=async nm=>{const f=F[nm];if(!f)return null;const o=f.o+30+dv.getUint16(f.o+26,true)+dv.getUint16(f.o+28,true),d=buf.subarray(o,o+f.c);if(f.m===0)return new TextDecoder().decode(d);if(f.m!==8||typeof DecompressionStream==='undefined')throw new Error(t('المتصفح ده مش بيفتح xlsx. احفظ الملف CSV.'));return new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()};\n const X=s=>new DOMParser().parseFromString(s,'application/xml'),tx=el=>Array.from(el.getElementsByTagNameNS('*','t')).map(x=>x.textContent).join('');\n const ss=await rd('xl/sharedStrings.xml');const sst=ss?Array.from(X(ss).getElementsByTagNameNS('*','si')).map(tx):[];\n const sn=Object.keys(F).filter(k=>/^xl\\/worksheets\\/sheet\\d+\\.xml$/.test(k)).sort((a,b)=>parseInt(a.match(/\\d+/g).pop())-parseInt(b.match(/\\d+/g).pop()))[0];if(!sn)throw new Error(t('الملف مش Excel صالح.'));\n const rows=[];for(const rw of X(await rd(sn)).getElementsByTagNameNS('*','row')){const row=[];for(const c of rw.getElementsByTagNameNS('*','c')){const col=(c.getAttribute('r')||'').replace(/\\d+/g,'').split('').reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1;if(col<0)continue;const ty=c.getAttribute('t'),v=c.getElementsByTagNameNS('*','v')[0];let val='';if(ty==='inlineStr')val=tx(c);else if(v)val=ty==='s'?(sst[+v.textContent]||''):v.textContent;while(row.length<col)row.push('');row[col]=val}rows.push(row.map(x=>x==null?'':String(x)))}\n return rows.filter(r=>r.some(x=>x.trim()))}\n\nfunction qdlBlob(bytes,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}\nconst QCRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();\nfunction qcrc(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=QCRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}\nfunction qzip(files){const enc=new TextEncoder(),parts=[],cd=[];let off=0;const u16=v=>[v&255,v>>8&255],u32=v=>[v&255,v>>8&255,v>>16&255,v>>>24&255];\n for(const [name,txt] of files){const nm=enc.encode(name),d=enc.encode(txt),crc=qcrc(d);const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0),...nm]);parts.push(lh,d);\n  cd.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off),...nm]));off+=lh.length+d.length}\n const cs=cd.reduce((a,b)=>a+b.length,0);const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(cd.length),...u16(cd.length),...u32(cs),...u32(off),...u16(0)]);\n const all=[...parts,...cd,end];const out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let p=0;for(const x of all){out.set(x,p);p+=x.length}return out}\nfunction xlsxBuild(sheets){const esc2=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]/g,'');\n const col=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};\n const sx=sh=>'<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetViews><sheetView workbookViewId=\"0\"'+(sh.rtl?' rightToLeft=\"1\"':'')+'>'+(sh.freeze?'<pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>':'')+'</sheetView></sheetViews><cols>'+(sh.widths||[]).map((w,i)=>'<col min=\"'+(i+1)+'\" max=\"'+(i+1)+'\" width=\"'+w+'\" customWidth=\"1\"/>').join('')+'</cols><sheetData>'+sh.rows.map((r,ri)=>'<row r=\"'+(ri+1)+'\">'+r.map((v,ci)=>{const st=(sh.styles&&sh.styles(ri,ci))||0,ref=col(ci)+(ri+1);if(v===''||v==null)return st?'<c r=\"'+ref+'\" s=\"'+st+'\"/>':'';return typeof v==='number'?'<c r=\"'+ref+'\" s=\"'+st+'\"><v>'+v+'</v></c>':'<c r=\"'+ref+'\" s=\"'+st+'\" t=\"inlineStr\"><is><t xml:space=\"preserve\">'+esc2(v)+'</t></is></c>'}).join('')+'</row>').join('')+'</sheetData></worksheet>';\n const files=[['[Content_Types].xml','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>'+sheets.map((_,i)=>'<Override PartName=\"/xl/worksheets/sheet'+(i+1)+'.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>').join('')+'</Types>'],\n ['_rels/.rels','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>'],\n ['xl/workbook.xml','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>'+sheets.map((x,i)=>'<sheet name=\"'+esc2(x.name)+'\" sheetId=\"'+(i+1)+'\" r:id=\"rId'+(i+1)+'\"/>').join('')+'</sheets></workbook>'],\n ['xl/_rels/workbook.xml.rels','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">'+sheets.map((_,i)=>'<Relationship Id=\"rId'+(i+1)+'\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet'+(i+1)+'.xml\"/>').join('')+'<Relationship Id=\"rId'+(sheets.length+1)+'\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>'],\n ['xl/styles.xml','<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><color rgb=\"FFFFFFFF\"/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts><fills count=\"4\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE60000\"/></patternFill></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFFDECEC\"/></patternFill></fill></fills><borders count=\"2\"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style=\"thin\"><color rgb=\"FFE5C4C4\"/></left><right style=\"thin\"><color rgb=\"FFE5C4C4\"/></right><top style=\"thin\"><color rgb=\"FFE5C4C4\"/></top><bottom style=\"thin\"><color rgb=\"FFE5C4C4\"/></bottom><diagonal/></border></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"5\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"><alignment wrapText=\"1\" vertical=\"center\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyBorder=\"1\"><alignment wrapText=\"1\" vertical=\"top\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFill=\"1\" applyBorder=\"1\"><alignment horizontal=\"center\" vertical=\"top\"/></xf><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"><alignment wrapText=\"1\" vertical=\"top\"/></xf></cellXfs></styleSheet>'],\n ...sheets.map((x,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sx(x)])];\n return qzip(files)}\nfunction qtemplateSheets(){const H=['type','question','seconds','correct_number','option1','option2','option3','option4','option5','option6','max_points'];\n const rows=[H,\n  ['mc','عميل زعلان من التأخير. تعمل إيه الأول؟',20,1,'تسمعه للآخر','تقاطعه','تحوله لزميلك','','','',10],\n  ['mc','What is the capital of Egypt?',15,1,'Cairo','Alexandria','Giza','Aswan','','',20],\n  ['spot','فين الغلطة في المحادثة؟',20,2,'أهلاً بحضرتك','دي مش مشكلتي','هشوف الموضوع','','','',10],\n  ['cloud','كلمة واحدة تصف خدمة العملاء',30,'','','','','','','','']];\n while(rows.length<41)rows.push(['','','','','','','','','','','']);\n const info=[['RoomPulse Quiz template | قالب كويز رومبولس'],[''],\n  ['1) Sheet \"Questions\": one row = one question (up to 50). Delete the 4 example rows or overwrite them. | الشيت Questions: كل صف سؤال (لحد ٥٠). امسح الأمثلة أو اكتب فوقها.'],\n  ['2) type: mc = multiple choice, spot = spot the mistake, cloud = word cloud. | type: mc اختيار من متعدد، spot اكتشف الغلطة، cloud سحابة كلمات.'],\n  ['3) correct_number = the NUMBER of the correct option (1 = option1, 2 = option2 ...). Leave empty for cloud. | correct_number = رقم الإجابة الصح (1 يعني option1، 2 يعني option2 ...). سيبه فاضي في cloud.'],\n  ['4) Options: mc takes 2 to 4 options, spot takes 2 to 6. Leave unused option cells empty. | mc من ٢ لـ ٤ اختيارات، spot من ٢ لـ ٦. سيب الخانات الفاضية.'],\n  ['5) seconds = time for the question (5 to 240, default 20). max_points = the question\\'s top score (1 to 1000, default 10); faster correct answers earn more. | seconds وقت السؤال (٥ لـ ٢٤٠). max_points أقصى نقاط للسؤال (١ لـ ١٠٠٠، الافتراضي ١٠). الأسرع في الإجابة الصح بياخد أكتر.'],\n  ['6) Save as .xlsx, then in the Quiz tab press Import and choose this file. | احفظ الملف .xlsx وبعدين من تبويب كويز اضغط استيراد واختار الملف.']];\n return [{name:'Questions',rows,widths:[8,48,10,15,22,22,22,22,14,14,12],freeze:true,styles:(r,c)=>r===0?1:(c===3||c===0||c===2||c===10)?3:2},{name:'Read me',rows:info,widths:[140],styles:(r)=>r===0?1:4}]}\nfunction qdt(ts){try{return new Date(ts).toLocaleString(lang==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'})}catch{return''}}\nfunction histView(r){const h=Q.hist||{games:[],total:0},o=Q.histOpen;\n if(o){const rp=o.report;r.innerHTML='<span class=\"eyebrow\">'+t('السجل')+'</span><h2 dir=\"auto\">'+esc(rp.title)+'</h2><p class=\"muted\">'+qdt(o.ended)+' · '+rp.players.length+' '+t('لاعب')+'</p><div class=\"qglass\"><h3>'+t('النتيجة النهائية')+'</h3><div class=\"qlb\">'+rp.players.map(p=>'<div class=\"r\"><span>'+p.rank+'. <bdi dir=\"auto\">'+esc(p.name)+'</bdi>'+(rp.teams?' <small class=\"qbadge\">'+t('الفريق')+' '+p.team+'</small>':'')+'</span><span>'+fmtp(p.score)+'</span></div>').join('')+'</div>'+(rp.teamBoard?'<h3>'+t('ترتيب الفرق')+'</h3><div class=\"qlb\">'+rp.teamBoard.map((x,i)=>'<div class=\"r\"><span>'+(i+1)+'. '+t('الفريق')+' '+x.team+' <small class=\"qbadge\">'+x.members+' '+t('عضو')+'</small></span><span>'+fmtp(x.score)+'</span></div>').join('')+'</div>':'')+'<h3>'+t('الأسئلة')+'</h3><div class=\"qlb\">'+rp.questions.map((q,i)=>'<div class=\"r\"><span>'+(i+1)+'. <bdi dir=\"auto\">'+esc(q.text)+'</bdi></span><span>'+(q.type==='cloud'?q.answered:q.pct+'%')+'</span></div>').join('')+'</div>'\n  +'<div class=\"actions\"><button id=\"hexp\">'+t('تصدير الجدول CSV')+'</button><button class=\"secondary qbtn-danger\" id=\"hdel\">'+t('احذف من السجل')+'</button><button class=\"secondary\" id=\"hback\">'+t('رجوع')+'</button></div></div>';\n  $('hexp').onclick=()=>qdownload(reportCSV(rp,o.ended),(rp.title||'results')+'-'+new Date(o.ended).toISOString().slice(0,16).replace(/[:T]/g,'-')+'.csv');\n  $('hdel').onclick=()=>qhdel(o.code);$('hback').onclick=()=>{Q.histOpen=null;qrender()};return}\n r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><div class=\"qrow between\"><h2>'+t('السجل')+' ('+h.total+')</h2><button class=\"secondary\" id=\"hlib\">'+t('رجوع للمكتبة')+'</button></div><p class=\"muted\">'+t('كل لعبة بتخلص بتتحفظ هنا لحد ما تمسحها.')+'</p>'\n  +(h.games.length?'<div id=\"hlist\">'+h.games.map(g=>'<div class=\"qitem\" data-c=\"'+esc(g.code)+'\"><span><b dir=\"auto\">'+esc(g.title)+'</b><small>'+qdt(g.ended)+' · '+g.players+' '+t('لاعب')+(g.teams?' · '+g.teams+' '+t('فرق'):'')+(g.top&&g.top[0]?' · 🥇 <bdi dir=\"auto\">'+esc(g.top[0].name)+'</bdi> '+fmtp(g.top[0].score):'')+'</small></span><span class=\"qrow\"><button class=\"secondary\" data-a=\"open\">'+t('تفاصيل')+'</button><button class=\"secondary\" data-a=\"csv\">CSV</button><button class=\"secondary qbtn-danger\" data-a=\"del\">'+t('احذف')+'</button></span></div>').join('')+'</div>':'<div class=\"qglass\"><p class=\"muted\">'+t('لسه مفيش ألعاب مخلصة.')+'</p></div>');\n $('hlib').onclick=()=>{Q.view='lib';qrender()};\n const L=$('hlist');if(L)L.onclick=async e=>{const b=e.target.closest('button[data-a]');if(!b)return;const code=b.closest('.qitem').dataset.c,a=b.dataset.a;try{if(a==='del')return qhdel(code);const d=await qapi('/history/'+code,null,Q.tok);if(a==='open'){Q.histOpen={...d,code};qrender()}else qdownload(reportCSV(d.report,d.ended),(d.report.title||'results')+'-'+new Date(d.ended).toISOString().slice(0,16).replace(/[:T]/g,'-')+'.csv')}catch(er){qerr(er)}}}\nasync function qhdel(code){if(!confirm(t('تمسح اللعبة دي من السجل نهائياً؟')))return;try{await qapi('/history/delete',{code},Q.tok);Q.hist=await qapi('/history',null,Q.tok);Q.histOpen=null;qrender()}catch(e){qerr(e)}}\n/* ---------- builder ---------- */\nfunction qcard(x,i,n){const spot=x.type==='spot',cloud=x.type==='cloud';\n let h='<div class=\"qqcard\" data-i=\"'+i+'\"><div class=\"qrow between\"><span><span class=\"qtag\">'+(i+1)+'</span> <b>'+typeName(x.type)+'</b></span><span class=\"qrow\"><button type=\"button\" class=\"secondary\" data-a=\"up\" '+(i?'':'disabled')+' aria-label=\"'+t('فوق')+'\">↑</button><button type=\"button\" class=\"secondary\" data-a=\"down\" '+(i<n-1?'':'disabled')+' aria-label=\"'+t('تحت')+'\">↓</button><button type=\"button\" class=\"secondary qbtn-danger\" data-a=\"rm\">'+t('احذف السؤال')+'</button></span></div>'\n +'<label>'+t(spot?'الموقف أو التعليمات':'نص السؤال')+'</label><textarea data-f=\"text\" dir=\"auto\" maxlength=\"300\" style=\"min-height:70px\">'+esc(x.text)+'</textarea>';\n if(!cloud){h+='<p class=\"muted\">'+t(spot?'اختار السطر الغلط':'اختار الإجابة الصح')+'</p>';x.options.forEach((o,k)=>{h+='<div class=\"qopt\"><input type=\"radio\" name=\"c'+i+'\" data-f=\"correct\" data-k=\"'+k+'\" '+(x.correct===k?'checked':'')+' aria-label=\"'+t('اختار الإجابة الصح')+'\"><input type=\"text\" data-f=\"opt\" data-k=\"'+k+'\" dir=\"auto\" maxlength=\"'+(spot?200:120)+'\" placeholder=\"'+t(spot?'سطر في المحادثة':'اختيار')+' '+(k+1)+'\" value=\"'+esc(o)+'\">'+(x.options.length>2?'<button type=\"button\" class=\"secondary\" data-a=\"rmopt\" data-k=\"'+k+'\" aria-label=\"x\">✕</button>':'')+'</div>'});\n  if(x.options.length<(spot?6:4))h+='<button type=\"button\" class=\"secondary\" data-a=\"addopt\">+ '+t(spot?'إضافة سطر':'إضافة اختيار')+'</button>'}\n h+='<div class=\"qrow\" style=\"margin-top:10px\"><label style=\"margin:0\">'+t('الوقت بالثواني')+'</label><input type=\"number\" data-f=\"time\" min=\"5\" max=\"240\" value=\"'+x.time+'\" style=\"width:100px\"></div>'+(cloud?'':'<div class=\"qrow\" style=\"margin-top:10px\"><label style=\"margin:0\">'+t('أقصى نقاط للسؤال')+'</label><input type=\"number\" data-f=\"points\" min=\"1\" max=\"1000\" step=\"1\" value=\"'+(x.points||10)+'\" style=\"width:100px\"></div><p class=\"muted\">'+t('الإجابة الصح الأسرع بتاخد نقاط أكتر. الغلط بصفر.')+'</p>')+'</div>';return h}\nfunction editView(r){const d=Q.draft;\n r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><div class=\"qglass\"><label for=\"qtitle\">'+t('اسم الكويز')+'</label><input id=\"qtitle\" dir=\"auto\" maxlength=\"80\" value=\"'+esc(d.title)+'\"><div id=\"qcards\">'+d.questions.map((x,i)=>qcard(x,i,d.questions.length)).join('')+'</div>'\n +'<p class=\"muted\">'+t('أضف سؤال')+'</p><div class=\"qrow\"><button type=\"button\" class=\"secondary\" data-add=\"mc\">+ '+t('اختيار من متعدد')+'</button><button type=\"button\" class=\"secondary\" data-add=\"spot\">+ '+t('اكتشف الغلطة')+'</button><button type=\"button\" class=\"secondary\" data-add=\"cloud\">+ '+t('سحابة كلمات')+'</button></div>'\n +'<div class=\"actions\"><button id=\"qsave\">'+t('احفظ الكويز')+'</button><button class=\"secondary\" id=\"qcsv\">'+t('تصدير CSV')+'</button><button class=\"secondary\" id=\"qcancel\">'+t('إلغاء')+'</button></div></div>';\n $('qtitle').oninput=e=>d.title=e.target.value;\n const cards=$('qcards');\n cards.oninput=e=>{const c=e.target.closest('.qqcard');if(!c)return;const x=d.questions[+c.dataset.i],f=e.target.dataset.f;if(f==='text')x.text=e.target.value;else if(f==='opt')x.options[+e.target.dataset.k]=e.target.value;else if(f==='points')x.points=Math.max(1,Math.min(1000,parseInt(e.target.value)||10));else if(f==='time')x.time=Math.max(5,Math.min(240,parseInt(e.target.value)||20))};\n cards.onchange=e=>{const c=e.target.closest('.qqcard');if(c&&e.target.dataset.f==='correct')d.questions[+c.dataset.i].correct=+e.target.dataset.k};\n cards.onclick=e=>{const b=e.target.closest('button[data-a]');if(!b)return;const i=+b.closest('.qqcard').dataset.i,x=d.questions[i],a=b.dataset.a;\n  if(a==='rm')d.questions.splice(i,1);else if(a==='up')[d.questions[i-1],d.questions[i]]=[d.questions[i],d.questions[i-1]];else if(a==='down')[d.questions[i+1],d.questions[i]]=[d.questions[i],d.questions[i+1]];\n  else if(a==='addopt')x.options.push('');else if(a==='rmopt'){const k=+b.dataset.k;x.options.splice(k,1);if(x.correct>=x.options.length||x.correct>k)x.correct=Math.max(0,x.correct>k?x.correct-1:0)}\n  editView($('quizRoot'))};\n r.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{d.questions.push(qblank(b.dataset.add));editView(r);window.scrollTo(0,document.body.scrollHeight)});\n $('qcancel').onclick=()=>{Q.view='lib';qrender()};$('qcsv').onclick=()=>qdownload(toCSV(d),(d.title||'quiz')+'.csv');\n $('qsave').onclick=async()=>{try{if(!d.title.trim())throw new Error(t('اكتب اسم الكويز.'));if(!d.questions.length)throw new Error(t('أضف سؤال واحد على الأقل.'));\n  if(d.questions.some(x=>!x.text.trim()))throw new Error(t('اكتب نص كل سؤال.'));if(d.questions.some(x=>x.options&&x.options.some(o=>!o.trim())))throw new Error(t('كمّل اختيارات كل سؤال.'));\n  const res=await qapi('/library/save',{id:Q.draftId,quiz:d},Q.tok);await qreloadLib();$('globalError').textContent=''}catch(e){qerr(e)}}}\n/* ---------- launch ---------- */\nfunction launchView(r){const L=Q.launch;r.innerHTML='<span class=\"eyebrow\">'+t('كويز')+'</span><h2 dir=\"auto\">'+esc(L.title)+'</h2><div class=\"qglass\"><div class=\"mode-buttons\"><button class=\"secondary\" id=\"qsolo\" aria-pressed=\"'+(L.teams===0)+'\">'+t('كل واحد لوحده')+'</button><button class=\"secondary\" id=\"qteams\" aria-pressed=\"'+(L.teams>0)+'\">'+t('فرق')+'</button></div>'+(L.teams>0?'<label for=\"qn\">'+t('عدد الفرق')+'</label><select id=\"qn\" style=\"font:inherit;padding:10px;border-radius:8px\">'+[2,3,4,5,6].map(n=>'<option '+(n===L.teams?'selected':'')+'>'+n+'</option>').join('')+'</select>':'')+'<div class=\"actions\"><button id=\"qgo\">'+t('ابدأ اللوبي')+'</button><button class=\"secondary\" id=\"qback\">'+t('إلغاء')+'</button></div></div>';\n $('qsolo').onclick=()=>{L.teams=0;launchView(r)};$('qteams').onclick=()=>{L.teams=L.teams||2;launchView(r)};if($('qn'))$('qn').onchange=e=>L.teams=+e.target.value;$('qback').onclick=()=>{Q.view='lib';qrender()};\n $('qgo').onclick=async()=>{try{const d=await qapi('/game/create',{quizId:L.id,teams:L.teams},Q.tok);Q.host={code:d.code,token:d.token,title:L.title};qhostSave();Q.view='host';Q.sig='';Q.gs=null;Q.report=null;startHostPoll()}catch(e){qerr(e)}}}\n/* ---------- host game ---------- */\nfunction startHostPoll(){qstop();hostTick();Q.poll=setInterval(()=>{if(role!=='quiz'){qstop();return}if(!document.hidden)hostTick()},1500);qtimerLoop()}\nasync function hostTick(){if(!Q.host)return;try{const s=await qapi('/game/'+Q.host.code+'/state',null,Q.host.token);Q.off=s.serverNow-Date.now();Q.gs=s;\n  if(s.phase==='ended'&&!Q.report&&!Q.reporting){Q.reporting=true;try{Q.report=await qapi('/game/'+Q.host.code+'/report',null,Q.host.token)}catch{}Q.reporting=false}\n  const sig=[s.phase,s.qi,s.answered,s.playerCount,s.state,!!Q.report,lang].join('|');if(sig!==Q.sig){Q.sig=sig;qrender()}}catch(e){if(/الكود غير صحيح/.test(e.message)){Q.host=null;qhostSave();qstop();Q.view=Q.tok?'lib':'auth';qrender()}}}\nfunction qtimerLoop(){clearInterval(Q.tl);Q.tl=setInterval(()=>{const s=Q.gs;if(!s||!['quiz','quizPlay'].includes(role))return;const el=document.getElementById('qtime');if(el&&s.phase==='answering'){const r=qrem(s);el.textContent=r;const b=document.getElementById('qtbar');if(b){const tot=Math.max(1,(s.qEnd-s.qStart)/1000);b.style.width=Math.max(0,Math.min(100,100*r/tot))+'%'}if(r===0&&!Q.refetch){Q.refetch=true;setTimeout(()=>{Q.refetch=false;role==='quiz'?hostTick():playTick()},500)}}},250)}\nfunction optCls(i){return 'c'+(i%6)}\nfunction lbHtml(s,meName){return '<div class=\"qlb\">'+(s.leaderboard||[]).map(p=>'<div class=\"r'+(meName&&p.name===meName?' me':'')+'\"><span>'+p.rank+'. <bdi dir=\"auto\">'+esc(p.name)+'</bdi>'+(s.teams?' <small class=\"qbadge\">'+t('الفريق')+' '+p.team+'</small>':'')+'</span><span>'+fmtp(p.score)+'</span></div>').join('')+'</div>'}\nfunction teamHtml(s){return s.teamBoard?'<h3>'+t('ترتيب الفرق')+'</h3><div class=\"qlb\">'+s.teamBoard.map((x,i)=>'<div class=\"r\"><span>'+(i+1)+'. '+t('الفريق')+' '+x.team+' <small class=\"qbadge\">'+x.members+' '+t('عضو')+'</small></span><span>'+fmtp(x.score)+'</span></div>').join('')+'</div>':''}\nfunction cloudHtml(words){if(!words||!words.length)return'';const mx=Math.max(...words.map(w=>w.n));const cols=['#E60000','#30242a','#b3001b','#7a6068'];return '<div class=\"qcloud\" dir=\"auto\">'+words.map((w,i)=>'<span style=\"font-size:'+Math.round(16+34*w.n/mx)+'px;font-weight:'+(w.n>1?900:700)+';color:'+cols[i%4]+'\">'+esc(w.word)+'</span>').join('')+'</div>'}\nfunction podiumHtml(lb){const a=lb||[];const b=(i)=>a[i]?'<bdi dir=\"auto\">'+esc(a[i].name)+'</bdi><br>'+fmtp(a[i].score):'';return '<div class=\"qpod\"><div class=\"p2\">2<br>'+b(1)+'</div><div class=\"p1\">1<br>'+b(0)+'</div><div class=\"p3\">3<br>'+b(2)+'</div></div>'}\nfunction qshare(){const s=Q.gs;if(!s)return;const u=location.origin+joinPath+'?code='+s.code+'&lang='+lang;const title=Q.host.title||s.title||'';const txt=t('انضم للكويز')+': '+title+'\\n'+t('الكود')+': '+s.code+'\\n'+u;if(navigator.share){navigator.share({title:title,text:txt,url:u}).catch(()=>{})}else{const done=()=>{const b=$('qshare');if(b){const o=b.textContent;b.textContent=t('اتنسخ الرابط والكود');setTimeout(()=>{if($('qshare'))$('qshare').textContent=o},2000)}};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,()=>prompt(t('انسخ الرابط'),txt));else prompt(t('انسخ الرابط'),txt)}}\nasync function qendGame(){if(!Q.host)return;if(!confirm(t('تنهي اللعبة دلوقتي؟ هتتسجل في السجل.')))return;try{await qapi('/game/'+Q.host.code+'/host',{action:'end'},Q.host.token);Q.sig='';if(Q.view==='host'){await hostTick()}else{Q.host=null;qhostSave();Q.gs=null;Q.report=null;await qreloadLib()}}catch(e){qerr(e)}}\nfunction hostView(r){hostView0(r);const b=r.querySelector('#qshare');if(b){b.onclick=qshare;if(Q.gs&&Q.gs.phase!=='ended'){const e=document.createElement('button');e.type='button';e.className='secondary qbtn-danger';e.id='qendgame';e.textContent=t('إنهاء اللعبة');e.onclick=qendGame;b.after(e)}}}\nfunction hostView0(r){const s=Q.gs;if(!s){r.innerHTML='<p class=\"muted\">…</p>';return}\n const head='<div class=\"qrow between\"><span class=\"qtag dark\" dir=\"ltr\">'+s.code+'</span><span class=\"qtag\">'+esc(Q.host.title||s.title)+'</span><button type=\"button\" class=\"secondary\" id=\"qshare\">'+t('شارك الرابط')+'</button></div>';\n if(s.phase==='lobby'){const u=location.origin+joinPath+'?code='+s.code+'&lang='+lang;\n  r.innerHTML=head+'<div class=\"qglass qcenter\"><p>'+t('ادخل على الرابط واكتب الكود')+'</p><div class=\"qcode\">'+s.code+'</div><img id=\"qqr\" alt=\"QR\" width=\"200\" height=\"200\" src=\"'+apiOrigin+'/qr?code='+s.code+'&lang='+lang+(pagesHost?'&frontend=pages':'')+'\" style=\"background:#fff;border-radius:12px\"><p class=\"muted\" dir=\"ltr\">'+esc(u)+'</p><h3>'+(s.playerCount||0)+' '+t('انضموا')+'</h3><div class=\"qchips\">'+(s.players||[]).map(p=>'<span class=\"qchip\" dir=\"auto\">'+esc(p.name)+(s.teams?' · '+p.team:'')+'</span>').join('')+'</div><p class=\"muted\">'+((s.playerCount||0)?'':t('استنى المتدربين يدخلوا…'))+'</p><div class=\"actions\" style=\"justify-content:center\"><button id=\"qstart\" '+(s.playerCount?'':'disabled')+'>'+t('ابدأ الكويز')+'</button><button class=\"secondary\" id=\"qleave\">'+t('رجوع للمكتبة')+'</button></div></div>';\n  $('qstart').onclick=()=>hostAct({action:'start'});$('qleave').onclick=()=>{qstop();Q.view='lib';qrender()};return}\n if(s.phase==='answering'||s.phase==='reveal'){const q=s.q,rev=s.phase==='reveal',cloud=q.type==='cloud';let body='';\n  if(!cloud)body='<div class=\"qans\">'+q.options.map((o,i)=>'<div class=\"qa '+optCls(i)+(rev&&i===q.correct?' right':'')+(rev&&i!==q.correct?' dim':'')+'\"><span class=\"sym\">'+SYM[i]+'</span><span dir=\"auto\" style=\"flex:1\">'+esc(o)+'</span>'+(rev?'<span class=\"cnt\">'+(s.counts?s.counts[i]:0)+'</span>':(i===q.correct?'<span>✓</span>':''))+'</div>').join('')+'</div>';\n  else if(rev)body=cloudHtml(s.words);\n  r.innerHTML=head+'<div class=\"qglass\"><div class=\"qrow between\"><span class=\"qtag\">'+(s.qi+1)+' / '+s.total+'</span>'+(rev?'<span class=\"qtag dark\">'+(s.answered||0)+' '+t('أجاوبوا')+'</span>':'<div class=\"qtimer\" id=\"qtime\">'+qrem(s)+'</div><span class=\"qtag dark\">'+(s.answered||0)+'/'+(s.playerCount||0)+' '+t('أجاوبوا')+'</span>')+'</div>'+(rev?'':'<div class=\"qbar\"><i id=\"qtbar\" style=\"width:100%\"></i></div>')+'<div class=\"qq\" dir=\"auto\">'+esc(q.text)+'</div>'+body\n  +(rev?'<h3>'+t('الترتيب')+'</h3>'+lbHtml(s)+teamHtml(s):'')+'<div class=\"actions\">'+(rev?'<button id=\"qnext\">'+t(s.qi+1>=s.total?'اعرض النتيجة النهائية':'السؤال التالي')+'</button>':'<button class=\"secondary\" id=\"qrev\">'+t('اعرض النتيجة دلوقتي')+'</button>')+'</div></div>';\n  if(rev)$('qnext').onclick=()=>hostAct({action:'next',qi:s.qi});else $('qrev').onclick=()=>hostAct({action:'reveal'});return}\n if(s.phase==='ended'){const rp=Q.report;r.innerHTML=head+'<div class=\"qglass\"><h2 class=\"qcenter\">'+t('النتيجة النهائية')+'</h2>'+podiumHtml(s.leaderboard)+lbHtml(s)+teamHtml(s)+'</div>'\n  +'<div class=\"qglass\"><h2>'+t('تقرير الجلسة')+'</h2>'+(rp?rp.questions.map(q=>'<div class=\"qitem\" style=\"display:block\"><b dir=\"auto\">'+(q.index+1)+'. '+esc(q.text)+'</b>'+(q.type==='cloud'?'<div>'+cloudHtml(q.words.slice(0,40))+'</div>':'<div class=\"qbar\"><i style=\"width:'+q.pct+'%'+(q.pct<50?';background:#30242a':'')+'\"></i></div><small>'+q.pct+'% '+t('صح')+(q.pct<50?' · ⚠ '+t('محتاج مراجعة'):'')+'</small>'+(q.wrong.length?'<small>'+t('اللي غلطوا')+': '+q.wrong.map(w=>'<bdi dir=\"auto\">'+esc(w.name)+'</bdi>').join('، ')+'</small>':'')+(q.missing.length?'<small>'+t('ماجاوبوش')+': '+q.missing.map(w=>'<bdi dir=\"auto\">'+esc(w)+'</bdi>').join('، ')+'</small>':''))+'</div>').join(''):'<p class=\"muted\">'+t('جاري تجهيز التقرير…')+'</p>')\n  +'<div class=\"actions\"><button id=\"qexp\" '+(rp?'':'disabled')+'>'+t('تصدير النتايج CSV')+'</button><button class=\"secondary\" id=\"qdone\">'+t('رجوع للمكتبة')+'</button></div></div>';\n  $('qexp').onclick=()=>{if(!Q.report)return;qdownload(reportCSV(Q.report),(Q.report.title||'results')+'-results.csv')};\n  $('qdone').onclick=()=>{qstop();Q.host=null;qhostSave();Q.gs=null;Q.report=null;Q.view='lib';openQuiz()}}}\nfunction reportCSV(rp,when){const n=rp.questions.length,L=[];if(when)L.push(['date',new Date(when).toISOString().replace('T',' ').slice(0,16)+' UTC'],['quiz',rp.title],[]);L.push(['rank','name','team','score',...(rp.players[0]&&rp.players[0].pts?rp.questions.map((_,i)=>'Q'+(i+1)+'_points'):[])]);for(const p of rp.players)L.push([p.rank,p.name,rp.teams?p.team:'',fmtp(p.score),...(p.pts?p.pts.map(fmtp):[])]);L.push([]);L.push(['question','type','answered','correct_percent','wrong_names']);for(const q of rp.questions)L.push([q.text,q.type,q.answered,q.type==='cloud'?'':q.pct,q.type==='cloud'?q.words.map(w=>w.word+'×'+w.n).join(' | '):q.wrong.map(w=>w.name).join(' | ')]);return L.map(r=>r.map(csvCell).join(',')).join('\\r\\n')}\nasync function hostAct(b){try{await qapi('/game/'+Q.host.code+'/host',b,Q.host.token);Q.sig='';hostTick()}catch(e){qerr(e)}}\n/* ---------- player ---------- */\nasync function quizTryJoin(){const code=$('joinCode').value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));if(!/^\\d{6}$/.test(code))return join();\n let s;try{s=await qapi('/game/'+code+'/state?client='+encodeURIComponent(client()))}catch(e){return join()}\n Q.pl={code,name:null};Q.gs=s;Q.off=s.serverNow-Date.now();Q.sig='';let nm=null;try{nm=sessionStorage.getItem('quiz.name.'+code)}catch{}\n show('quizPlay');if(s.me){Q.pl.name=s.me.name;startPlayPoll();playRender()}else if(nm&&s.state!=='ended'){await playJoin(nm)}else playRender()}\nasync function playJoin(name){try{const d=await qapi('/game/'+Q.pl.code+'/join',{client:client(),name});Q.pl.name=d.name;try{sessionStorage.setItem('quiz.name.'+Q.pl.code,d.name)}catch{}Q.sig='';startPlayPoll();await playTick()}catch(e){error(e);playRender()}}\nfunction startPlayPoll(){qstop();Q.poll=setInterval(()=>{if(role!=='quizPlay'){qstop();return}if(!document.hidden)playTick()},1500);qtimerLoop()}\nasync function playTick(){try{const s=await qapi('/game/'+Q.pl.code+'/state?client='+encodeURIComponent(client()));Q.off=s.serverNow-Date.now();const prev=Q.gs;Q.gs=s;if(prev&&(prev.qi!==s.qi||prev.phase!==s.phase))Q.sel=-1;const sig=[s.phase,s.qi,s.me&&s.me.answered,s.me&&s.me.score,s.me&&s.me.rank,lang].join('|');if(sig!==Q.sig){Q.sig=sig;playRender()}}catch(e){}}\nasync function playSend(body){try{await qapi('/game/'+Q.pl.code+'/answer',{client:client(),qi:Q.gs.qi,...body});Q.sig='';await playTick()}catch(e){error(e);await playTick()}}\nfunction playRender(){if(role!=='quizPlay')return;const r=$('quizPlayRoot'),s=Q.gs;\n const head='<div class=\"qrow between\"><span class=\"qtag\">'+esc(s.title)+'</span>'+(s.me?'<span class=\"qtag dark\" dir=\"auto\">'+esc(s.me.name)+' · '+fmtp(s.me.score)+'</span>':'')+'</div>';\n if(!s.me){r.innerHTML=head+'<div class=\"qglass\"><h2>'+t('اكتب اسمك')+'</h2><input id=\"qname\" dir=\"auto\" maxlength=\"40\" placeholder=\"'+t('اكتب اسمك')+'\" autocomplete=\"off\"><div class=\"actions\"><button id=\"qjoin\">'+t('ادخل الكويز')+'</button></div></div>';\n  const go=()=>{const v=$('qname').value.trim();if(v)playJoin(v)};$('qjoin').onclick=go;$('qname').onkeydown=e=>{if(e.key==='Enter')go()};return}\n if(s.phase==='lobby'){r.innerHTML=head+'<div class=\"qglass qcenter\"><div class=\"qbig\">🎮</div><h2>'+t('أنت جوّه. استنى المدرب يبدأ.')+'</h2>'+(s.teams?'<p><b>'+t('فريقك')+': '+s.me.team+'</b></p>':'')+'<p class=\"muted\">'+(s.playerCount||0)+' '+t('انضموا')+'</p></div>';return}\n if(s.phase==='answering'){const q=s.q,a=s.me.answered;let body='';\n  if(q.type==='mc')body='<div class=\"qans\">'+q.options.map((o,i)=>'<button class=\"qa '+optCls(i)+(s.me.choice===i?' picked':'')+'\" data-i=\"'+i+'\" '+(a?'disabled':'')+'><span class=\"sym\">'+SYM[i]+'</span><span dir=\"auto\">'+esc(o)+'</span></button>').join('')+'</div>';\n  else if(q.type==='spot')body=q.options.map((o,i)=>'<button class=\"qbub'+((a?s.me.choice:Q.sel)===i?' picked':'')+'\" data-i=\"'+i+'\" '+(a?'disabled':'')+' dir=\"auto\">'+esc(o)+'</button>').join('')+(a?'':'<div class=\"actions\"><button id=\"qsend\" '+(Q.sel>=0?'':'disabled')+'>'+t('ابعت الإجابة')+'</button></div>');\n  else body=a?'<p class=\"qcenter\"><b dir=\"auto\">'+esc(s.me.text||'')+'</b></p>':'<input id=\"qword\" dir=\"auto\" maxlength=\"30\" placeholder=\"'+t('اكتب كلمة')+'\" autocomplete=\"off\"><div class=\"actions\"><button id=\"qsend\">'+t('ابعت')+'</button></div>';\n  r.innerHTML=head+'<div class=\"qglass\"><div class=\"qrow between\"><span class=\"qtag\">'+(s.qi+1)+' / '+s.total+'</span><div class=\"qtimer\" id=\"qtime\">'+qrem(s)+'</div></div><div class=\"qbar\"><i id=\"qtbar\" style=\"width:100%\"></i></div><div class=\"qq\" dir=\"auto\">'+esc(q.text)+'</div>'+body+(a?'<p class=\"qcenter muted\">'+t('اتسجلت إجابتك. استنى باقي القاعة…')+'</p>':'')+'</div>';\n  if(!a){if(q.type==='mc')r.querySelectorAll('button.qa').forEach(b=>b.onclick=()=>{r.querySelectorAll('button.qa').forEach(x=>x.disabled=true);playSend({choice:+b.dataset.i})});\n   else if(q.type==='spot'){r.querySelectorAll('.qbub').forEach(b=>b.onclick=()=>{Q.sel=+b.dataset.i;r.querySelectorAll('.qbub').forEach(x=>x.classList.toggle('picked',x===b));$('qsend').disabled=false});$('qsend').onclick=()=>{if(Q.sel>=0){$('qsend').disabled=true;playSend({choice:Q.sel})}}}\n   else{const go=()=>{const v=$('qword').value.trim();if(v){$('qsend').disabled=true;playSend({text:v})}};$('qsend').onclick=go;$('qword').onkeydown=e=>{if(e.key==='Enter')go()}}}return}\n if(s.phase==='reveal'){const m=s.me,q=s.q,cloud=q.type==='cloud';let top;\n  if(cloud)top='<div class=\"qbig\">☁️</div>'+cloudHtml(s.words);\n  else if(!m.answered)top='<div class=\"qbig\">⏱</div><h2 class=\"qcenter qno\">'+t('وقتك خلص')+'</h2>';\n  else top='<div class=\"qbig '+(m.ok?'qok':'qno')+'\">'+(m.ok?'✓':'✗')+'</div><h2 class=\"qcenter '+(m.ok?'qok':'qno')+'\">'+t(m.ok?'إجابة صح!':'إجابة غلط')+(m.ok?' +'+fmtp(m.points):'')+'</h2>';\n  const right=!cloud?'<p class=\"qcenter\">'+t('الإجابة الصح')+': <b dir=\"auto\">'+esc(q.options[q.correct])+'</b></p>':'';\n  r.innerHTML=head+'<div class=\"qglass qcenter\">'+top+right+'<p>'+t('نقاطك')+': <b>'+fmtp(m.score)+'</b> · '+t('مركزك')+': <b>'+(m.rank||'-')+'</b>'+(s.teams?' · '+t('ترتيب فريقك')+': <b>'+(m.teamRank||'-')+'</b>':'')+'</p><p class=\"muted\">'+t('استنى السؤال الجاي…')+'</p></div>'+'<div class=\"qglass\"><h3>'+t('الترتيب')+'</h3>'+lbHtml(s,m.name)+'</div>';return}\n if(s.phase==='ended'){const m=s.me;r.innerHTML=head+'<div class=\"qglass qcenter\"><h2>'+t('النتيجة النهائية')+'</h2>'+podiumHtml(s.leaderboard)+'<p>'+t('مركزك')+': <b>'+(m.rank||'-')+'</b> · '+t('نقاطك')+': <b>'+fmtp(m.score)+'</b>'+(s.teams?' · '+t('ترتيب فريقك')+': <b>'+(m.teamRank||'-')+'</b>':'')+'</p><p class=\"muted\">'+t('الكويز خلص. شكراً على المشاركة!')+'</p></div>'+teamHtml(s)}}\n/* ---------- wiring ---------- */\n$('quizTab').onclick=openQuiz;\n$('joinButton').onclick=quizTryJoin;\n{const _sl=setLanguage;setLanguage=function(v){_sl(v);Q.sig='';if(role==='quiz')qrender();if(role==='quizPlay'&&Q.gs)playRender()}}\n\ndocument.querySelectorAll('a[href=\"/\"]').forEach(a=>a.href=appBase);document.querySelectorAll('a[href=\"/join\"]').forEach(a=>a.href=joinPath);\n\nfunction moveSectionPill(){requestAnimationFrame(()=>{const nav=document.querySelector('.section-tabs'),active=nav.querySelector('[aria-pressed=\"true\"]');if(!active||nav.classList.contains('hidden'))return;nav.style.setProperty('--pill-x',active.offsetLeft+'px');nav.style.setProperty('--pill-y',active.offsetTop+'px');nav.style.setProperty('--pill-w',active.offsetWidth+'px');nav.style.setProperty('--pill-h',active.offsetHeight+'px')})}\nconst sectionNavObserver=new ResizeObserver(moveSectionPill);sectionNavObserver.observe(document.querySelector('.section-tabs'));for(const button of document.querySelectorAll('.section-tabs button'))sectionNavObserver.observe(button);document.fonts.ready.then(moveSectionPill);window.addEventListener('resize',moveSectionPill);\n\nif(location.pathname==='/join'||location.pathname===appBase+'join/'||location.pathname===appBase+'join/index.html'){show('join');const code=new URLSearchParams(location.search).get('code');if(code){$('joinCode').value=code;quizTryJoin()}}else{show('welcome');$('resumeBox').classList.toggle('hidden',!saved())}\n\n$('langAR').onclick=()=>setLanguage('ar');$('langEN').onclick=()=>setLanguage('en');applyLanguage();renderBank();setIdentity(identity);setMode(mode);\n</script></body></html>\n";
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
`CREATE INDEX IF NOT EXISTS quiz_history_ended ON quiz_history(ended)`
];
let quizReady=false;
async function qbody(req,max){const t=await req.text();if(t.length>max)fail('حجم الطلب أكبر من المسموح.',413);try{return t?JSON.parse(t):{}}catch{fail('بيانات الطلب غير صحيحة.')}}
async function qpass(salt,pass){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:10000},k,256);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function qissue(db,now){const token=crypto.randomUUID()+crypto.randomUUID();await db.prepare('DELETE FROM quiz_admin_tokens WHERE expires<?').bind(now).run();await db.prepare('INSERT INTO quiz_admin_tokens(hash,expires) VALUES(?,?)').bind(await hash(token),now+14*86400000).run();return token}
async function qadmin(req,db,now){const a=req.headers.get('Authorization')||'';if(!a.startsWith('Bearer '))fail('اكتب كلمة السر الأول.',401);const r=await db.prepare('SELECT 1 FROM quiz_admin_tokens WHERE hash=? AND expires>?').bind(await hash(a.slice(7)),now).first();if(!r)fail('الجلسة انتهت. ادخل كلمة السر تاني.',401)}
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
async function qsave(db,code,g,quiz,now){const r=await qreport(db,code,g,quiz,'ended');const top=r.players.slice(0,3).map(p=>({name:p.name,score:p.score}));await db.prepare('INSERT OR REPLACE INTO quiz_history(code,title,ended,teams,players,top,data) VALUES(?,?,?,?,?,?,?)').bind(code,quiz.title,now,g.teams,r.players.length,JSON.stringify(top),JSON.stringify(r)).run()}
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
  let points=x.points===undefined?10:x.points;if(!Number.isInteger(points)||points<1||points>1000)fail('أقصى نقاط السؤال '+(i+1)+' من ١ لـ ١٠٠٠.');
  return {...out,options:opts,correct:x.correct,points}
 });
 return {title,questions}
}
function qpublicQ(q,withCorrect){const o={type:q.type,text:q.text,time:q.time,points:q.points||0};if(q.options)o.options=q.options;if(withCorrect&&q.correct!==undefined)o.correct=q.correct;return o}
async function qhandle(req,env,path,u,now){
 const db=env.DB;
 if(!quizReady){await db.batch(QSCHEMA.map(s=>db.prepare(s)));quizReady=true}
 const m=req.method,sub=path.slice('/api/quiz'.length);
 // ---- admin ----
 if(sub==='/admin/status'&&m==='GET'){const r=await db.prepare('SELECT 1 FROM quiz_admin WHERE id=1').first();return json({configured:!!r})}
 if(sub==='/admin/setup'&&m==='POST'){const b=await qbody(req,2048);const p=typeof b.passcode==='string'?b.passcode:'';if(p.length<4||p.length>64)fail('كلمة السر من ٤ لـ ٦٤ حرف أو رقم.');const salt=crypto.randomUUID();const r=await db.prepare('INSERT OR IGNORE INTO quiz_admin(id,salt,hash) VALUES(1,?,?)').bind(salt,await qpass(salt,p)).run();if(!r.meta.changes)fail('كلمة السر متحددة بالفعل. ادخل بيها.',409);return json({token:await qissue(db,now)},201)}
 if((sub==='/admin/login'||sub==='/admin/change')&&m==='POST'){
  const b=await qbody(req,2048);const recent=await db.prepare('SELECT count(*) n FROM quiz_attempts WHERE ts>?').bind(now-900000).first();if(recent.n>=8)fail('محاولات كتير غلط. استنى ١٥ دقيقة وجرّب تاني.',429);
  const row=await db.prepare('SELECT salt,hash FROM quiz_admin WHERE id=1').first();if(!row)fail('لسه مفيش كلمة سر. اتحدد الأول.',409);
  const p=typeof b.passcode==='string'?b.passcode:'';if(await qpass(row.salt,p)!==row.hash){await db.prepare('INSERT INTO quiz_attempts(ts) VALUES(?)').bind(now).run();fail('كلمة السر غلط.',403)}
  await db.prepare('DELETE FROM quiz_attempts').run();
  if(sub==='/admin/change'){const np=typeof b.newPasscode==='string'?b.newPasscode:'';if(np.length<4||np.length>64)fail('كلمة السر من ٤ لـ ٦٤ حرف أو رقم.');const salt=crypto.randomUUID();await db.batch([db.prepare('UPDATE quiz_admin SET salt=?,hash=? WHERE id=1').bind(salt,await qpass(salt,np)),db.prepare('DELETE FROM quiz_admin_tokens')]);return json({token:await qissue(db,now)})}
  return json({token:await qissue(db,now)})}
 // ---- library (admin) ----
 if(sub==='/library'&&m==='GET'){await qadmin(req,db,now);const r=await db.prepare('SELECT id,title,data,updated FROM quiz_library ORDER BY updated DESC').all();return json({quizzes:r.results.map(x=>{const d=JSON.parse(x.data);return {id:x.id,title:x.title,count:d.questions.length,types:[...new Set(d.questions.map(q=>q.type))],updated:x.updated}})})}
 let lm=sub.match(/^\/library\/([A-Za-z0-9-]{8,40})$/);
 if(lm&&m==='GET'){await qadmin(req,db,now);const r=await db.prepare('SELECT id,data FROM quiz_library WHERE id=?').bind(lm[1]).first();if(!r)fail('الكويز مش موجود.',404);return json({id:r.id,quiz:JSON.parse(r.data)})}
 if(sub==='/library/save'&&m==='POST'){await qadmin(req,db,now);const b=await qbody(req,70000);const quiz=qclean(b.quiz);let id=typeof b.id==='string'&&/^[A-Za-z0-9-]{8,40}$/.test(b.id)?b.id:null;
  if(id){const e=await db.prepare('SELECT 1 FROM quiz_library WHERE id=?').bind(id).first();if(!e)id=null}
  if(!id){const n=await db.prepare('SELECT count(*) n FROM quiz_library').first();if(n.n>=100)fail('وصلت للحد الأقصى ١٠٠ كويز. امسح كويز قديم.',429);id=crypto.randomUUID()}
  await db.prepare('INSERT INTO quiz_library(id,title,data,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data=excluded.data,updated=excluded.updated').bind(id,quiz.title,JSON.stringify(quiz),now).run();return json({id})}
 if(sub==='/library/delete'&&m==='POST'){await qadmin(req,db,now);const b=await qbody(req,2048);if(typeof b.id!=='string')fail('الكويز غير صحيح.');await db.prepare('DELETE FROM quiz_library WHERE id=?').bind(b.id).run();return json({ok:true})}
 // ---- games ----
 if(sub==='/history'&&m==='GET'){await qadmin(req,db,now);const r=await db.prepare('SELECT code,title,ended,teams,players,top FROM quiz_history ORDER BY ended DESC LIMIT 500').all();const n=await db.prepare('SELECT count(*) n FROM quiz_history').first();return json({games:r.results.map(x=>({...x,top:JSON.parse(x.top)})),total:n.n})}
 if(sub.startsWith('/history/')&&sub!=='/history/delete'&&m==='GET'){await qadmin(req,db,now);const r=await db.prepare('SELECT data,ended FROM quiz_history WHERE code=?').bind(sub.slice(9)).first();if(!r)fail('اللعبة مش موجودة في السجل.',404);return json({report:JSON.parse(r.data),ended:r.ended})}
 if(sub==='/history/delete'&&m==='POST'){await qadmin(req,db,now);const b=await qbody(req,2048);if(typeof b.code!=='string')fail('الكود غير صحيح.');await db.prepare('DELETE FROM quiz_history WHERE code=?').bind(b.code).run();return json({ok:true})}
 if(sub==='/game/create'&&m==='POST'){await qadmin(req,db,now);const b=await qbody(req,2048);const r=await db.prepare('SELECT data FROM quiz_library WHERE id=?').bind(String(b.quizId||'')).first();if(!r)fail('الكويز مش موجود.',404);
  const teams=b.teams===undefined||b.teams===0?0:b.teams;if(!Number.isInteger(teams)||teams<0||teams===1||teams>6)fail('عدد الفرق من ٢ لـ ٦.');
  await db.batch(['DELETE FROM quiz_answers WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_players WHERE code IN (SELECT code FROM quiz_games WHERE expires<?)','DELETE FROM quiz_games WHERE expires<?'].map(s=>db.prepare(s).bind(now)));
  const token=crypto.randomUUID()+crypto.randomUUID(),th=await hash(token);let code,ok=false;
  for(let i=0;i<8&&!ok;i++){code=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);const used=await db.prepare('SELECT 1 FROM sessions WHERE code=?').bind(code).first().catch(()=>null);if(used)continue;const x=await db.prepare("INSERT OR IGNORE INTO quiz_games(code,token,quiz,teams,state,qi,q_start,q_end,expires) VALUES(?,?,?,?,'lobby',0,0,0,?)").bind(code,th,r.data,teams,now+3*86400000).run();ok=!!x.meta.changes}
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
  await db.prepare('INSERT OR IGNORE INTO quiz_players(code,client,name,team,joined) VALUES(?,?,?,?,?)').bind(code,c,name,team,now).run();return json({ok:true,name,team},201)}
 if(action==='answer'&&m==='POST'){const b=await qbody(req,2048);const c=await client(b.client);
  if(g.state!=='question'||b.qi!==g.qi)fail('السؤال ده مش مفتوح.',409);if(now>g.q_end+1500)fail('الوقت خلص.',409);
  const p=await db.prepare('SELECT 1 FROM quiz_players WHERE code=? AND client=?').bind(code,c).first();if(!p)fail('ادخل بالاسم الأول.',403);
  const q=quiz.questions[g.qi];let choice=null,text=null,ok=0,points=0;const ms=Math.max(0,now-g.q_start);
  if(q.type==='cloud'){let w=typeof b.text==='string'?b.text.trim().replace(/\s+/g,' ').toLowerCase():'';if(!w||w.length>30)fail('اكتب كلمة أو جملة قصيرة لحد ٣٠ حرف.');text=w}
  else{if(!Number.isInteger(b.choice)||b.choice<0||b.choice>=q.options.length)fail('اختيار غير صحيح.');choice=b.choice;ok=choice===q.correct?1:0;if(ok)points=Math.round(q.points*(1-0.5*Math.min(1,ms/(q.time*1000)))*100)/100}
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
  const me=c?await db.prepare('SELECT name,team,score FROM quiz_players WHERE code=? AND client=?').bind(code,c).first():null;
  const cur=g.state==='question'?quiz.questions[g.qi]:null;const answering=!!cur&&now<g.q_end;out.phase=g.state==='lobby'?'lobby':g.state==='ended'?'ended':answering?'answering':'reveal';
  if(cur)out.q=qpublicQ(cur,isHost||!answering);
  if(me){out.me={name:me.name,team:me.team,score:me.score};if(cur){const a=await db.prepare('SELECT choice,text,points,ok FROM quiz_answers WHERE code=? AND qi=? AND client=?').bind(code,g.qi,c).first();out.me.answered=!!a;if(a&&!answering){out.me.ok=!!a.ok;out.me.points=a.points}if(a&&answering&&cur.type==='cloud')out.me.text=a.text;if(a&&cur.type!=='cloud')out.me.choice=a.choice}}
  if(isHost||g.state==='lobby'){const cnt=await db.prepare('SELECT count(*) n FROM quiz_players WHERE code=?').bind(code).first();out.playerCount=cnt.n;if(g.state==='lobby'){const l=await db.prepare('SELECT name,team FROM quiz_players WHERE code=? ORDER BY joined DESC LIMIT 60').bind(code).all();out.players=l.results}}
  if(isHost&&answering){const a=await db.prepare('SELECT count(*) n FROM quiz_answers WHERE code=? AND qi=?').bind(code,g.qi).first();out.answered=a.n}
  if(g.state==='question'&&!answering||g.state==='ended'){
   const lb=await db.prepare('SELECT client,name,team,score FROM quiz_players WHERE code=? ORDER BY score DESC,joined').bind(code).all();let prev=null,rank=0;const rows=lb.results.map((p,i)=>{if(p.score!==prev)rank=i+1;prev=p.score;return {...p,rank}});
   out.leaderboard=rows.slice(0,g.state==='ended'?10:5).map(p=>({rank:p.rank,name:p.name,team:p.team,score:p.score}));out.playerCount=rows.length;const mine=rows.find(p=>p.client===c);if(mine&&out.me)out.me.rank=mine.rank;
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
if(path.startsWith('/api/quiz/'))return await qhandle(req,env,path,u,now);
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
  if(!apiRoute||!allowed)return response;
  const out=new Response(response.body,response);out.headers.set('Access-Control-Allow-Origin',PAGES_ORIGIN);out.headers.set('Vary','Origin');return out;
 }
};
